/**
 * Use Case diagrams — đúng checklist Buyer / Seller / Admin của bạn.
 * Run: node docs/diagrams/generate-uc-checklist.js
 */
const fs = require('fs');
const path = require('path');
const OUT = __dirname;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(id, value, x, y, w, h, style, parent = '1') {
  return `<mxCell id="${id}" value="${esc(value)}" style="${style}" vertex="1" parent="${parent}">
          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>
        </mxCell>`;
}

function edge(id, source, target) {
  return `<mxCell id="${id}" style="endArrow=none;html=1;rounded=0;strokeColor=#6c8ebf;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="${source}" target="${target}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

const STYLE = {
  actor:
    'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=13;',
  uc: 'ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=10;',
  system:
    'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#666666;dashed=1;verticalAlign=top;fontStyle=1;fontSize=14;spacingTop=6;',
  package:
    'swimlane;fontStyle=1;align=center;verticalAlign=top;startSize=26;horizontal=1;collapsible=0;fillColor=#f5f5f5;strokeColor=#666666;fontSize=12;whiteSpace=wrap;',
  note: 'shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;align=left;spacingLeft=4;',
  title: 'text;html=1;strokeColor=none;fillColor=none;align=left;fontStyle=1;fontSize=16;',
};

function page(name, id, w, h, cellsXml) {
  return `  <diagram id="${id}" name="${esc(name)}">
    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${w}" pageHeight="${h}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cellsXml}
      </root>
    </mxGraphModel>
  </diagram>`;
}

function mxfile(pages) {
  return `<mxfile host="app.diagrams.net" modified="2026-07-24T03:00:00.000Z" agent="FastMark" version="22.1.0" type="device">
${pages.join('\n')}
</mxfile>
`;
}

/**
 * packages: [{ title, cases: string[] }]
 * actorName, systemTitle, note?
 */
function buildChecklistPage({ name, id, actorName, systemTitle, packages, note }) {
  const cols = 3;
  const ucW = 300;
  const ucH = 46;
  const gapX = 18;
  const gapY = 12;
  const pad = 20;
  const pkgInnerW = cols * ucW + (cols - 1) * gapX + pad * 2;

  let y = 70;
  const cells = [];
  cells.push(cell(`${id}_t`, systemTitle, 200, 12, 900, 30, STYLE.title));
  cells.push(cell(`${id}_actor`, actorName, 40, 100, 60, 90, STYLE.actor));

  // Compute total height
  let contentH = 40;
  packages.forEach((pkg) => {
    const rows = Math.ceil(pkg.cases.length / cols);
    contentH += 34 + rows * (ucH + gapY) + 24;
  });
  const sysH = Math.max(900, contentH + 40);
  const sysW = pkgInnerW + 40;
  cells.push(cell(`${id}_sys`, systemTitle, 160, 50, sysW, sysH, STYLE.system));

  packages.forEach((pkg, pi) => {
    const rows = Math.ceil(pkg.cases.length / cols);
    const boxH = 34 + rows * (ucH + gapY) + 10;
    const boxX = 180;
    cells.push(cell(`${id}_pkg${pi}`, pkg.title, boxX, y, pkgInnerW, boxH, STYLE.package));
    pkg.cases.forEach((uc, ui) => {
      const c = ui % cols;
      const r = Math.floor(ui / cols);
      const x = boxX + pad + c * (ucW + gapX);
      const uy = y + 34 + r * (ucH + gapY);
      const uid = `${id}_uc${pi}_${ui}`;
      cells.push(cell(uid, uc, x, uy, ucW, ucH, STYLE.uc));
      if (ui === 0) {
        cells.push(edge(`${id}_ed${pi}`, `${id}_actor`, uid));
      }
    });
    y += boxH + 18;
  });

  if (note) {
    cells.push(cell(`${id}_note`, note, 40, y + 20, 280, 120, STYLE.note));
  }

  return page(name, id, Math.max(1400, sysW + 220), Math.max(1100, y + 180), cells.join('\n'));
}

const buyerPackages = [
  {
    title: '1. Tài khoản',
    cases: [
      'Đăng ký / Đăng nhập',
      'Đăng nhập Google',
      'Cập nhật hồ sơ cá nhân',
      'Đổi ảnh đại diện',
      'Đổi mật khẩu',
      'Đăng xuất',
    ],
  },
  {
    title: '2. Khám phá',
    cases: [
      'Xem sản phẩm gần bạn',
      'Xem gian hàng gần bạn',
      'Xem trên bản đồ',
      'Tìm kiếm sản phẩm',
      'Tìm kiếm gian hàng / người dùng',
      'Lọc theo danh mục',
      'Lọc theo khoảng cách',
      'Lọc theo giá',
      'Xem banner quảng cáo',
      'Xem tất cả (SP giảm giá / gần bạn)',
    ],
  },
  {
    title: '3. Sản phẩm',
    cases: [
      'Xem chi tiết sản phẩm',
      'Xem ảnh sản phẩm',
      'Xem biến thể sản phẩm',
      'Xem đánh giá',
      'Xem thông tin gian hàng',
      'Chia sẻ sản phẩm',
      'Yêu thích sản phẩm',
      'Xem giá khuyến mãi (% giảm)',
    ],
  },
  {
    title: '4. Gian hàng',
    cases: [
      'Xem hồ sơ gian hàng',
      'Theo dõi gian hàng',
      'Bỏ theo dõi gian hàng',
      'Xem danh sách sản phẩm của shop',
      'Gọi điện / Chỉ đường',
      'Báo cáo gian hàng',
    ],
  },
  {
    title: '5. Đặt giữ hàng',
    cases: [
      'Đặt giữ sản phẩm',
      'Thanh toán cọc bằng ví (nếu có)',
      'Hủy yêu cầu giữ hàng',
      'Xem trạng thái giữ hàng',
      'Xem lịch sử giữ hàng',
      'Xác nhận đã nhận hàng (quét QR)',
      'Báo cáo không nhận được hàng',
    ],
  },
  {
    title: '6. Chat',
    cases: ['Nhắn tin với người bán', 'Gửi ảnh trong chat', 'Xem lịch sử chat'],
  },
  {
    title: '7. Đánh giá',
    cases: ['Đánh giá gian hàng / đơn', 'Sửa đánh giá', 'Xóa đánh giá', 'Xem đánh giá của tôi'],
  },
  {
    title: '8. Thông báo & Ví',
    cases: [
      'Nhận thông báo hệ thống',
      'Nhận thông báo tin nhắn',
      'Nhận thông báo giữ hàng',
      'Nhận thông báo khuyến mãi',
      'Cài đặt thông báo',
      'Xem ví / nạp PayOS / rút tiền',
    ],
  },
  {
    title: '9. Seller Verification',
    cases: ['Đăng ký trở thành người bán', 'Theo dõi trạng thái duyệt hồ sơ'],
  },
];

const sellerPackages = [
  {
    title: '1. Hồ sơ người bán',
    cases: [
      'Đăng ký Seller (CCCD + selfie + vị trí)',
      'Xác thực SĐT OTP',
      'Cập nhật hồ sơ Seller',
      'Xem trạng thái xác thực',
    ],
  },
  {
    title: '2. Quản lý gian hàng',
    cases: [
      'Tạo / kích hoạt gian hàng (sau duyệt)',
      'Cập nhật thông tin gian hàng (bio)',
      'Cập nhật ảnh đại diện shop',
      'Cập nhật ảnh bìa shop',
      'Quản lý giờ hoạt động',
      'Bật/tắt mở cửa + % tiền cọc',
      'Xem / chia sẻ QR nhận hàng',
      'Xem người theo dõi',
      'Xem preview shop như buyer',
    ],
  },
  {
    title: '3. Quản lý sản phẩm',
    cases: [
      'Thêm sản phẩm',
      'Cập nhật sản phẩm',
      'Xóa sản phẩm',
      'Ẩn / Hiện sản phẩm',
      'Quản lý tồn kho',
      'Quản lý biến thể',
      'Upload nhiều ảnh sản phẩm',
      'Xem lượt xem sản phẩm',
      'Xem lượt thích sản phẩm',
      'Ghim sản phẩm (vị trí 1–2)',
    ],
  },
  {
    title: '4. Quản lý đơn giữ hàng',
    cases: [
      'Nhận yêu cầu giữ hàng',
      'Chấp nhận giữ hàng',
      'Từ chối giữ hàng',
      'Hủy đơn giữ hàng',
      'Xác nhận giao hàng (QR buyer)',
      'Báo buyer không đến',
      'Xem lịch sử đơn giữ hàng',
    ],
  },
  {
    title: '5. Khuyến mãi (tương đương Voucher)',
    cases: [
      'Tạo khuyến mãi % giảm giá',
      'Sửa khuyến mãi',
      'Gỡ / tắt khuyến mãi',
      'Áp khuyến mãi hàng loạt',
      'Đặt ngày bắt đầu / kết thúc KM',
    ],
  },
  {
    title: '6. Chat',
    cases: ['Nhắn tin với người mua', 'Gửi ảnh', 'Quản lý hội thoại'],
  },
  {
    title: '7. Đánh giá',
    cases: ['Xem đánh giá', 'Báo cáo đánh giá xấu'],
  },
  {
    title: '8. Thống kê',
    cases: [
      'Tổng sản phẩm',
      'Tổng lượt xem',
      'Tổng lượt thích',
      'Tổng người theo dõi',
      'Tổng đơn giữ hàng',
      'Sản phẩm nổi bật / kỳ thống kê',
    ],
  },
  {
    title: '9. Gói Seller & Banner',
    cases: [
      'Đăng ký gói Seller (trừ ví)',
      'Gia hạn gói Seller',
      'Xem lịch sử giao dịch ví',
      'Mua gói Banner',
      'Upload / cấu hình banner',
    ],
  },
];

const adminPackages = [
  {
    title: '1. Quản lý tài khoản',
    cases: [
      'Xem danh sách người dùng',
      'Khóa tài khoản',
      'Mở khóa tài khoản',
      'Xóa / vô hiệu tài khoản',
      'Phân quyền / xem role',
    ],
  },
  {
    title: '2. Duyệt Seller',
    cases: [
      'Xem hồ sơ đăng ký',
      'Duyệt hồ sơ',
      'Từ chối hồ sơ',
      'Xem CCCD',
      'Xem ảnh chân dung',
      'Gửi lý do từ chối',
    ],
  },
  {
    title: '3. Quản lý gian hàng',
    cases: ['Xem danh sách gian hàng', 'Khóa gian hàng', 'Mở khóa gian hàng', 'Xóa / ẩn gian hàng'],
  },
  {
    title: '4. Quản lý sản phẩm',
    cases: ['Xem sản phẩm', 'Ẩn sản phẩm vi phạm', 'Khôi phục sản phẩm', 'Xóa sản phẩm'],
  },
  {
    title: '5. Quản lý danh mục',
    cases: ['Thêm danh mục', 'Sửa danh mục', 'Xóa danh mục', 'Bật/Tắt danh mục'],
  },
  {
    title: '6. Quản lý Banner',
    cases: [
      'Thêm / sửa gói banner',
      'Duyệt treo banner seller',
      'Từ chối / gỡ treo banner',
      'Sắp xếp / bật tắt hiển thị',
    ],
  },
  {
    title: '7. Khuyến mãi hệ thống / gói',
    cases: [
      'Quản lý gói Seller (thêm/sửa/xóa/bật tắt)',
      'Xem subscription đã bán',
      'Doanh thu gói / banner',
    ],
  },
  {
    title: '8. Quản lý thông báo',
    cases: [
      'Gửi thông báo toàn hệ thống',
      'Gửi thông báo theo nhóm người dùng',
      'Xóa thông báo',
    ],
  },
  {
    title: '9. Quản lý báo cáo & đơn',
    cases: [
      'Xem báo cáo từ người dùng',
      'Xử lý báo cáo',
      'Đóng báo cáo',
      'Theo dõi đơn giữ hàng / tranh chấp',
      'Duyệt rút tiền / quản lý ngân hàng',
    ],
  },
  {
    title: '10. Thống kê hệ thống (biểu đồ ngày/tháng/năm)',
    cases: [
      'Tổng người dùng',
      'Tổng Seller',
      'Tổng gian hàng',
      'Tổng sản phẩm',
      'Tổng đơn giữ hàng',
      'Doanh thu gói Seller',
      'Doanh thu Banner',
      'Số gói Seller đã bán',
      'Số Banner đã bán',
      'Biểu đồ theo ngày / tháng / năm',
      'Audit log',
    ],
  },
];

const overviewPackages = [
  {
    title: 'Buyer',
    cases: [
      'Tài khoản & hồ sơ',
      'Khám phá / Map / Search',
      'SP & Shop',
      'Giữ hàng + QR + cọc',
      'Chat / Đánh giá / Thông báo',
      'Ví nạp-rút',
      'Đăng ký Seller',
    ],
  },
  {
    title: 'Seller',
    cases: [
      'Hồ sơ & xác thực',
      'Cài đặt gian hàng',
      'CRUD sản phẩm + ghim',
      'Đơn giữ hàng',
      'Khuyến mãi %',
      'Gói Seller + Banner',
      'Thống kê & đánh giá',
    ],
  },
  {
    title: 'Admin',
    cases: [
      'Tài khoản & duyệt Seller',
      'Shop / SP / Danh mục',
      'Banner & gói Seller',
      'Thông báo hệ thống',
      'Báo cáo / tranh chấp / rút tiền',
      'Dashboard biểu đồ D/M/Y',
    ],
  },
];

const pages = [
  buildChecklistPage({
    name: 'UC Tổng quan',
    id: 'uc-overview-full',
    actorName: 'Hệ thống\nFastMark',
    systemTitle: 'FastMark – Use Case tổng (Buyer · Seller · Admin)',
    packages: overviewPackages,
    note: 'Chi tiết từng actor ở các trang tiếp theo.',
  }),
  buildChecklistPage({
    name: 'UC Buyer đầy đủ',
    id: 'uc-buyer-full',
    actorName: 'Buyer',
    systemTitle: 'FastMark Mobile – Use Case Người mua (đầy đủ)',
    packages: buyerPackages,
    note: 'Ghi chú FastMark:\n• Lọc giá: ưu tiên qua khoảng giá biến thể / search\n• Chia sẻ: deep link / share OS nếu có\n• KM = % giảm giá (không có voucher code riêng)',
  }),
  buildChecklistPage({
    name: 'UC Seller đầy đủ',
    id: 'uc-seller-full',
    actorName: 'Seller',
    systemTitle: 'FastMark Mobile – Use Case Người bán (đầy đủ)',
    packages: sellerPackages,
    note: 'Ghi chú FastMark:\n• Voucher checklist = Khuyến mãi % giảm giá + bulk promo\n• Ảnh bìa: dùng avatar/cover từ hồ sơ shop\n• Phản hồi ĐG: hiện có xem + báo cáo ĐG',
  }),
  buildChecklistPage({
    name: 'UC Admin đầy đủ',
    id: 'uc-admin-full',
    actorName: 'Admin',
    systemTitle: 'FastMark Admin Web – Use Case quản trị (đầy đủ)',
    packages: adminPackages,
    note: 'Dashboard có metric + biểu đồ theo khoảng ngày;\nFinance / Seller Plans / Banner Plans / Withdrawals / Banks / Reports / Audit.',
  }),
];

const outName = '00-UC-Checklist-Day-du.drawio';
fs.writeFileSync(path.join(OUT, outName), mxfile(pages), 'utf8');
console.log('Wrote', outName);

// Also refresh individual role files as focused copies
fs.writeFileSync(
  path.join(OUT, '03-UC-Buyer.drawio'),
  mxfile([
    buildChecklistPage({
      name: 'UC Buyer',
      id: 'uc-buyer',
      actorName: 'Buyer',
      systemTitle: 'Buyer – Use Case đầy đủ',
      packages: buyerPackages,
    }),
  ]),
  'utf8'
);
fs.writeFileSync(
  path.join(OUT, '04-UC-Seller.drawio'),
  mxfile([
    buildChecklistPage({
      name: 'UC Seller',
      id: 'uc-seller',
      actorName: 'Seller',
      systemTitle: 'Seller – Use Case đầy đủ',
      packages: sellerPackages,
    }),
  ]),
  'utf8'
);
fs.writeFileSync(
  path.join(OUT, '06-UC-Admin.drawio'),
  mxfile([
    buildChecklistPage({
      name: 'UC Admin',
      id: 'uc-admin',
      actorName: 'Admin',
      systemTitle: 'Admin – Use Case đầy đủ',
      packages: adminPackages,
    }),
  ]),
  'utf8'
);
console.log('Updated 03-UC-Buyer, 04-UC-Seller, 06-UC-Admin');

const readmePath = path.join(OUT, 'README.md');
const readme = `# FastMark – Sơ đồ Use Case & Activity (.drawio)

Mở bằng [app.diagrams.net](https://app.diagrams.net).

## Use Case (checklist đầy đủ)
| File | Nội dung |
|------|----------|
| **\`00-UC-Checklist-Day-du.drawio\`** | **File chính** – 4 trang: Tổng quan + Buyer + Seller + Admin (đúng checklist) |
| \`03-UC-Buyer.drawio\` | Buyer đầy đủ |
| \`04-UC-Seller.drawio\` | Seller đầy đủ |
| \`06-UC-Admin.drawio\` | Admin đầy đủ |
| \`01\` \`02\` \`05\` | Bản rút gọn / Auth / Ví (tham khảo thêm) |

### Mapping checklist → FastMark hiện tại
| Checklist | Trong code FastMark |
|-----------|---------------------|
| Voucher | **Khuyến mãi % giảm giá** (+ bulk), không có mã voucher riêng |
| Lọc theo giá | Khoảng giá biến thể / discover; bộ lọc giá riêng có thể mở rộng |
| Chia sẻ sản phẩm | Share OS / deep link (tùy bản build) |
| Ảnh bìa shop | Cover/avatar trên StoreDetail + cài đặt shop |
| Phản hồi đánh giá | Seller **xem + báo cáo** đánh giá |
| Biểu đồ D/M/Y | Admin **Dashboard / Finance** theo khoảng ngày |

## Activity 3 cột
| File | Vai trò |
|------|---------|
| \`08-Activity-Buyer-3cot.drawio\` | Buyer |
| \`09-Activity-Seller-3cot.drawio\` | Seller |
| \`10-Activity-Admin-3cot.drawio\` | Admin |

## Tái tạo
\`\`\`bash
node docs/diagrams/generate-uc-checklist.js
node docs/diagrams/generate-activity-swimlanes.js
\`\`\`
`;
fs.writeFileSync(readmePath, readme, 'utf8');
console.log('Updated README.md');
