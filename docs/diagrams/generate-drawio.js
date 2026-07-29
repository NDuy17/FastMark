/**
 * Generate FastMark .drawio diagrams (use case + activity) for diagrams.net
 * Run: node docs/diagrams/generate-drawio.js
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

function edge(id, source, target, label = '', style = 'endArrow=block;html=1;rounded=0;fontSize=11;') {
  const value = label ? ` value="${esc(label)}"` : '';
  return `<mxCell id="${id}"${value} style="${style}" edge="1" parent="1" source="${source}" target="${target}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

const STYLE = {
  actor: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=12;',
  uc: 'ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;',
  system: 'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#666666;dashed=1;verticalAlign=top;fontStyle=1;fontSize=14;spacingTop=8;',
  package: 'swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=28;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;fillColor=#f5f5f5;strokeColor=#666666;fontSize=12;',
  note: 'shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;align=left;spacingLeft=6;',
  // activity
  start: 'ellipse;html=1;shape=startState;fillColor=#000000;strokeColor=#000000;',
  end: 'ellipse;html=1;shape=endState;fillColor=#000000;strokeColor=#000000;',
  action: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;',
  decision: 'rhombus;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontSize=11;',
  swim: 'swimlane;horizontal=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontStyle=1;startSize=32;',
};

function page(name, id, width, height, cellsXml) {
  return `  <diagram id="${id}" name="${esc(name)}">
    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cellsXml}
      </root>
    </mxGraphModel>
  </diagram>`;
}

function mxfile(diagrams) {
  return `<mxfile host="app.diagrams.net" modified="2026-07-24T02:00:00.000Z" agent="FastMark" version="22.1.0" type="device">
${diagrams.join('\n')}
</mxfile>
`;
}

/** Place use cases in columns inside a system box */
function buildUseCasePage({ name, id, systemTitle, actors, packages }) {
  // packages: [{ title, cases: string[] }]
  const pageW = 1800;
  const pageH = 1400;
  const cells = [];
  let cid = 2;

  // Actors left
  const actorIds = [];
  actors.forEach((a, i) => {
    const aid = `actor${i}`;
    actorIds.push(aid);
    cells.push(cell(aid, a, 40, 80 + i * 140, 50, 80, STYLE.actor));
  });

  // System boundary
  cells.push(cell('sys', systemTitle, 180, 40, 1550, 1280, STYLE.system));

  let y = 70;
  packages.forEach((pkg, pi) => {
    const cases = pkg.cases;
    const cols = 3;
    const rows = Math.ceil(cases.length / cols);
    const boxH = 40 + rows * 70;
    const boxW = 1480;
    const boxX = 210;
    cells.push(cell(`pkg${pi}`, pkg.title, boxX, y, boxW, boxH, STYLE.package));
    cases.forEach((uc, ui) => {
      const col = ui % cols;
      const row = Math.floor(ui / cols);
      const x = boxX + 30 + col * 480;
      const uy = y + 40 + row * 65;
      const uid = `uc${pi}_${ui}`;
      cells.push(cell(uid, uc, x, uy, 440, 50, STYLE.uc));
      if (actorIds[0] && ui < 2) {
        cells.push(
          edge(
            `e${pi}_${ui}`,
            actorIds[Math.min(ui, actorIds.length - 1)],
            uid,
            '',
            'endArrow=none;html=1;rounded=0;dashed=1;strokeColor=#999999;'
          )
        );
      }
    });
    y += boxH + 24;
  });

  return page(name, id, pageW, Math.max(pageH, y + 80), cells.join('\n'));
}

function buildActivityPage({ name, id, title, steps }) {
  // steps: array of {type:'action'|'decision'|'start'|'end', text, yes?, no?}
  // Simple vertical flow with optional branches simplified as labeled edges
  const cells = [];
  let y = 40;
  cells.push(cell('title', title, 200, 10, 500, 30, 'text;html=1;fontStyle=1;fontSize=16;align=center;'));
  let prev = null;
  let idx = 0;

  steps.forEach((s, i) => {
    const sid = `s${i}`;
    if (s.type === 'start') {
      cells.push(cell(sid, '', 420, y, 30, 30, STYLE.start));
      y += 60;
    } else if (s.type === 'end') {
      cells.push(cell(sid, '', 420, y, 30, 30, STYLE.end));
    } else if (s.type === 'decision') {
      cells.push(cell(sid, s.text, 320, y, 230, 80, STYLE.decision));
      y += 110;
    } else {
      cells.push(cell(sid, s.text, 280, y, 310, 50, STYLE.action));
      y += 80;
    }
    if (prev != null) {
      const label = s.edgeLabel || '';
      cells.push(edge(`e${idx++}`, prev, sid, label));
    }
    prev = sid;
  });

  return page(name, id, 900, Math.max(1100, y + 100), cells.join('\n'));
}

function buildActorLinkedUseCase({ name, id, systemTitle, actorsWithCases }) {
  // actorsWithCases: [{ actor, cases: string[] }]
  const cells = [];
  let cid = 10;
  const pageW = 2000;
  const pageH = 1600;

  cells.push(cell('sys', systemTitle, 220, 40, 1550, 1480, STYLE.system));

  actorsWithCases.forEach((block, ai) => {
    const actorId = `actor${ai}`;
    cells.push(cell(actorId, block.actor, 40, 100 + ai * 280, 50, 80, STYLE.actor));
    block.cases.forEach((uc, ui) => {
      const col = ui % 3;
      const row = Math.floor(ui / 3);
      const baseY = 70 + ai * 280;
      const uid = `uc_${ai}_${ui}`;
      cells.push(cell(uid, uc, 260 + col * 480, baseY + row * 70, 440, 55, STYLE.uc));
      cells.push(edge(`ed_${ai}_${ui}`, actorId, uid, '', 'endArrow=none;html=1;rounded=0;strokeColor=#6c8ebf;'));
      cid++;
    });
  });

  return page(name, id, pageW, pageH, cells.join('\n'));
}

// ========== USE CASE FILES ==========

const ucTong = mxfile([
  buildUseCasePage({
    name: 'UC Tổng quan FastMark',
    id: 'uc-overview',
    systemTitle: 'Hệ thống FastMark (Mobile App + Admin Web)',
    actors: ['Guest', 'Buyer', 'Seller', 'Admin', 'Hệ thống\n(PayOS/Push)'],
    packages: [
      {
        title: '1. Xác thực & tài khoản',
        cases: [
          'Đăng ký / Đăng nhập email',
          'Đăng nhập Google + setup username',
          'Quên mật khẩu (OTP)',
          'Xác thực email',
          'Cập nhật hồ sơ / avatar',
          'Đăng xuất',
        ],
      },
      {
        title: '2. Marketplace (Buyer)',
        cases: [
          'Xem Home / banner / gần bạn / giảm giá',
          'Tìm kiếm SP + người dùng + lịch sử',
          'Bản đồ shop / chỉ đường',
          'Xem shop & sản phẩm',
          'Yêu thích / theo dõi shop',
          'Giữ hàng + cọc ví + QR nhận hàng',
          'Đánh giá / báo cáo / tranh chấp',
          'Chat với shop',
        ],
      },
      {
        title: '3. Gian hàng (Seller)',
        cases: [
          'Đăng ký bán + chờ Admin duyệt',
          'Cài đặt shop / QR / % cọc',
          'CRUD sản phẩm + KM + ghim',
          'Quản lý đơn bán / báo no-show',
          'Mua gói bán + banner',
          'Thống kê + quản lý đánh giá',
        ],
      },
      {
        title: '4. Ví & thanh toán',
        cases: [
          'Xem ví / lịch sử GD',
          'Nạp tiền PayOS',
          'Rút tiền (Admin duyệt)',
          'Trừ ví: cọc / gói / banner',
          'Hoàn / quyết toán cọc',
        ],
      },
      {
        title: '5. Admin Web – quản lý toàn hệ thống',
        cases: [
          'Duyệt seller / khóa tài khoản',
          'Quản lý shop / SP / danh mục',
          'Đơn hàng / tranh chấp / báo cáo',
          'Duyệt rút tiền / ngân hàng',
          'Gói bán / banner / tài chính',
          'Thông báo hệ thống / audit log',
        ],
      },
    ],
  }),
]);

const ucAuth = mxfile([
  buildActorLinkedUseCase({
    name: 'UC Auth',
    id: 'uc-auth',
    systemTitle: 'FastMark – Xác thực & tài khoản',
    actorsWithCases: [
      {
        actor: 'Guest',
        cases: [
          'Đăng ký tài khoản email',
          'Đăng nhập email/password',
          'Đăng nhập Google',
          'Thiết lập username (Google)',
          'Quên mật khẩu – gửi OTP',
          'Xác minh OTP & đặt lại mật khẩu',
        ],
      },
      {
        actor: 'Buyer/Seller',
        cases: [
          'Xác thực email (OTP)',
          'Xem / sửa hồ sơ',
          'Đổi avatar',
          'Cập nhật SĐT (OTP) khi đăng ký bán',
          'Đăng xuất',
          'Khôi phục session khi mở app',
        ],
      },
    ],
  }),
]);

const ucBuyer = mxfile([
  buildUseCasePage({
    name: 'UC Buyer đầy đủ',
    id: 'uc-buyer',
    systemTitle: 'FastMark Mobile – Vai trò Người mua (Buyer)',
    actors: ['Buyer', 'Seller\n(đối tác)', 'Hệ thống'],
    packages: [
      {
        title: 'Khám phá',
        cases: [
          'Xem trang chủ (banner, danh mục)',
          'Xem SP giảm giá / gần bạn / tất cả',
          'Tìm kiếm (gợi ý + lịch sử theo nick)',
          'Lọc theo danh mục',
          'Khám phá bản đồ shop nearby',
          'Chỉ đường tới gian hàng',
        ],
      },
      {
        title: 'Shop & sản phẩm',
        cases: [
          'Xem chi tiết gian hàng',
          'Gọi điện / nhắn tin shop',
          'Theo dõi / bỏ theo dõi shop',
          'Xem chi tiết sản phẩm + biến thể',
          'Thêm / bỏ yêu thích SP',
          'Xem danh sách yêu thích',
        ],
      },
      {
        title: 'Đơn hàng & nhận hàng',
        cases: [
          'Tạo giữ hàng (reservation)',
          'Thanh toán cọc bằng ví (nếu shop bật)',
          'Xem / hủy đơn mua',
          'Quét QR shop xác nhận nhận hàng',
          'Báo cáo seller không giao / tranh chấp',
          'Xử lý forfeit / hoàn cọc',
        ],
      },
      {
        title: 'Tương tác xã hội',
        cases: [
          'Chat realtime với shop',
          'Xem thông báo buyer',
          'Cài đặt nhận thông báo',
          'Đánh giá sau đơn (tạo/sửa/xóa)',
          'Báo cáo SP / shop / user',
          'Xem hoạt động: lịch sử / đã mua / ĐG',
          'Xem cửa hàng đã ghé',
          'Đăng ký trở thành người bán',
        ],
      },
    ],
  }),
]);

const ucSeller = mxfile([
  buildUseCasePage({
    name: 'UC Seller đầy đủ',
    id: 'uc-seller',
    systemTitle: 'FastMark Mobile – Vai trò Người bán (Seller)',
    actors: ['Buyer\n(chờ duyệt)', 'Seller', 'Admin', 'Hệ thống'],
    packages: [
      {
        title: 'Onboarding bán hàng',
        cases: [
          'Xác minh SĐT bằng OTP',
          'Nộp hồ sơ CCCD + selfie + vị trí + danh mục',
          'Xem trạng thái chờ duyệt / bị từ chối',
          'Sửa hồ sơ & gửi lại khi bị từ chối',
          'Nhận quyền Seller sau Admin duyệt',
        ],
      },
      {
        title: 'Cài đặt & vận hành shop',
        cases: [
          'Cài đặt shop (mô tả/bio, giờ, địa chỉ)',
          'Bật/tắt mở cửa, % tiền cọc',
          'Xem / chia sẻ QR nhận hàng cố định',
          'Xem preview shop như người mua',
          'Quản lý đánh giá + báo cáo review xấu',
        ],
      },
      {
        title: 'Sản phẩm & khuyến mãi',
        cases: [
          'Đăng sản phẩm mới (ảnh, biến thể, đơn vị)',
          'Sửa / ẩn / xóa mềm sản phẩm',
          'Thiết lập % giảm giá + thời gian KM',
          'Áp KM hàng loạt / gỡ KM',
          'Ghim sản phẩm vị trí 1–2',
        ],
      },
      {
        title: 'Đơn bán & tăng trưởng',
        cases: [
          'Xem / xác nhận / từ chối / hủy đơn',
          'Báo buyer không đến nhận',
          'Xem thống kê bán hàng',
          'Mua gói bán (subscription) bằng ví',
          'Mua gói banner + upload creative',
          'Chat với buyer / xem thông báo seller',
        ],
      },
    ],
  }),
]);

const ucWallet = mxfile([
  buildUseCasePage({
    name: 'UC Ví – Nạp rút – Gói – Banner',
    id: 'uc-wallet',
    systemTitle: 'FastMark – Ví & thanh toán (dùng chung Buyer/Seller)',
    actors: ['Buyer', 'Seller', 'Admin', 'PayOS'],
    packages: [
      {
        title: 'Ví người dùng',
        cases: [
          'Xem số dư ví FastMark',
          'Xem danh sách giao dịch',
          'Xem chi tiết 1 giao dịch',
          'Nạp tiền qua PayOS (checkout)',
          'Đồng bộ kết quả nạp (deep link)',
          'Tạo yêu cầu rút tiền',
          'Chọn ngân hàng thụ hưởng',
        ],
      },
      {
        title: 'Chi tiêu từ ví',
        cases: [
          'Trừ ví khi đặt cọc giữ hàng',
          'Hoàn cọc khi hoàn tất / hủy hợp lệ',
          'Forfeit cọc khi vi phạm',
          'Seller mua gói bán (subscription)',
          'Seller mua gói hiển thị banner',
          'Cấu hình / kích hoạt banner đã mua',
        ],
      },
      {
        title: 'Admin & cổng thanh toán',
        cases: [
          'Admin duyệt / từ chối rút tiền',
          'Admin quản lý danh sách ngân hàng',
          'Admin xem tài chính / đối soát',
          'PayOS tạo link thanh toán',
          'PayOS webhook / sync trạng thái nạp',
        ],
      },
    ],
  }),
]);

const ucAdmin = mxfile([
  buildUseCasePage({
    name: 'UC Admin Web – quản lý tất cả',
    id: 'uc-admin',
    systemTitle: 'FastMark Admin Web – Quản trị toàn hệ thống',
    actors: ['Admin', 'Buyer\n(đối tượng)', 'Seller\n(đối tượng)', 'Hệ thống'],
    packages: [
      {
        title: 'Truy cập & tổng quan',
        cases: [
          'Đăng nhập Admin',
          'Xem Dashboard tổng quan',
          'Xem audit log thao tác',
        ],
      },
      {
        title: 'Người dùng & seller',
        cases: [
          'Quản lý tài khoản (khóa / mở)',
          'Duyệt / từ chối hồ sơ seller',
          'Xem chi tiết verification CCCD',
          'Quản lý shop profile',
        ],
      },
      {
        title: 'Catalog & nội dung',
        cases: [
          'Quản lý danh mục SP / shop',
          'Quản lý sản phẩm toàn hệ thống',
          'Quản lý đánh giá',
          'Gửi thông báo hệ thống',
        ],
      },
      {
        title: 'Đơn hàng & an toàn',
        cases: [
          'Theo dõi reservations / đơn',
          'Xử lý tranh chấp (dispute)',
          'Xử lý báo cáo (report)',
          'Giám sát vi phạm',
        ],
      },
      {
        title: 'Tài chính & gói dịch vụ',
        cases: [
          'Duyệt rút tiền',
          'Quản lý ngân hàng',
          'Quản lý gói bán (seller plans)',
          'Quản lý subscription seller',
          'Quản lý gói banner / banner',
          'Xem báo cáo tài chính',
        ],
      },
    ],
  }),
]);

// ========== ACTIVITY ==========

const activities = mxfile([
  buildActivityPage({
    name: 'A1 Auth đăng nhập/đăng ký',
    id: 'act-auth',
    title: 'Luồng: Đăng ký / Đăng nhập / Google',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Mở app → màn Auth' },
      { type: 'decision', text: 'Chọn phương thức?' },
      { type: 'action', text: 'Email: Register/Login Firebase\nhoặc Google Sign-In', edgeLabel: 'Email/Google' },
      { type: 'decision', text: 'Google thiếu username?' },
      { type: 'action', text: 'Màn setup username', edgeLabel: 'Có' },
      { type: 'action', text: 'Load profile backend /auth/me' },
      { type: 'decision', text: 'Cần xác thực email?' },
      { type: 'action', text: 'OTP xác thực email', edgeLabel: 'Có' },
      { type: 'action', text: 'Vào AuthenticatedHome (tabs)' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A2 Quên mật khẩu',
    id: 'act-forgot',
    title: 'Luồng: Quên mật khẩu (OTP)',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Nhập email quên mật khẩu' },
      { type: 'action', text: 'Backend gửi OTP' },
      { type: 'action', text: 'User nhập OTP' },
      { type: 'decision', text: 'OTP hợp lệ?' },
      { type: 'action', text: 'Nhập mật khẩu mới', edgeLabel: 'Đúng' },
      { type: 'action', text: 'Cập nhật password → về Login' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A3 Giữ hàng + cọc',
    id: 'act-reserve',
    title: 'Luồng: Buyer giữ hàng & thanh toán cọc',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Xem ProductDetail → Giữ hàng' },
      { type: 'action', text: 'Chọn biến thể, SL, giờ nhận' },
      { type: 'decision', text: 'Shop yêu cầu cọc?' },
      { type: 'action', text: 'Kiểm tra số dư ví', edgeLabel: 'Có' },
      { type: 'decision', text: 'Đủ tiền?' },
      { type: 'action', text: 'Trừ ví + tạo reservation', edgeLabel: 'Đủ' },
      { type: 'action', text: 'Thông báo Seller + hiện đơn mua' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A4 QR nhận hàng',
    id: 'act-qr',
    title: 'Luồng: Quét QR xác nhận nhận hàng',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Buyer mở đơn → Quét QR' },
      { type: 'action', text: 'Seller hiện QR shop cố định' },
      { type: 'action', text: 'Quét & gửi mã + reservationId' },
      { type: 'decision', text: 'QR khớp shop & đơn hợp lệ?' },
      { type: 'action', text: 'Confirm received + quyết toán cọc', edgeLabel: 'OK' },
      { type: 'action', text: 'Mời đánh giá đơn' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A5 Đăng ký Seller + duyệt',
    id: 'act-seller-reg',
    title: 'Luồng: Đăng ký người bán → Admin duyệt',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Buyer: Xác minh SĐT OTP' },
      { type: 'action', text: 'Nộp CCCD, selfie, vị trí, danh mục' },
      { type: 'action', text: 'Lưu verification = PENDING' },
      { type: 'action', text: 'Admin mở hồ sơ trên web' },
      { type: 'decision', text: 'Duyệt?' },
      { type: 'action', text: 'Approve → role Seller + ShopProfile', edgeLabel: 'Duyệt' },
      { type: 'action', text: 'Mở hub Gian hàng cho Seller' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A6 Seller SP + KM + ghim',
    id: 'act-seller-product',
    title: 'Luồng: Đăng SP / khuyến mãi / ghim',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Seller mở Đăng tin / Sản phẩm' },
      { type: 'action', text: 'Nhập tên, danh mục, ảnh, biến thể, giá' },
      { type: 'action', text: 'Tùy chọn: bật % KM + ngày' },
      { type: 'action', text: 'Lưu product (cần gói bán active để public)' },
      { type: 'action', text: 'Ghim vị trí 1/2 (tối đa 2 SP)' },
      { type: 'action', text: 'Buyer thấy SP (ghim trước, có badge KM)' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A7 Seller xử lý đơn',
    id: 'act-seller-order',
    title: 'Luồng: Seller quản lý đơn bán',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Nhận thông báo đơn mới' },
      { type: 'action', text: 'Mở Đơn bán → chi tiết' },
      { type: 'decision', text: 'Xử lý?' },
      { type: 'action', text: 'Confirm / Reject / Cancel', edgeLabel: 'Thao tác' },
      { type: 'action', text: 'Chờ buyer nhận (QR) hoặc báo no-show' },
      { type: 'action', text: 'Cập nhật tồn kho / cọc / trạng thái' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A8 Nạp tiền PayOS',
    id: 'act-topup',
    title: 'Luồng: Nạp tiền ví qua PayOS',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Mở Ví → Nạp tiền → nhập số tiền' },
      { type: 'action', text: 'Backend tạo order + link PayOS' },
      { type: 'action', text: 'User thanh toán trên PayOS' },
      { type: 'action', text: 'Deep link / sync trạng thái' },
      { type: 'decision', text: 'Thành công?' },
      { type: 'action', text: 'Cộng số dư ví + ghi transaction', edgeLabel: 'OK' },
      { type: 'action', text: 'Màn TopUp Success' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A9 Rút tiền',
    id: 'act-withdraw',
    title: 'Luồng: Rút tiền (user → Admin duyệt)',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'User tạo yêu cầu rút + chọn NH' },
      { type: 'action', text: 'Khóa/giữ số dư chờ duyệt' },
      { type: 'action', text: 'Admin xem Withdrawals' },
      { type: 'decision', text: 'Duyệt?' },
      { type: 'action', text: 'Approve → trừ ví & hoàn tất', edgeLabel: 'Duyệt' },
      { type: 'action', text: 'Reject → hoàn lại số dư', edgeLabel: 'Từ chối' },
      { type: 'action', text: 'Thông báo user' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A10 Mua gói bán + banner',
    id: 'act-sub-banner',
    title: 'Luồng: Seller mua gói bán & banner',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Seller mở Gói bán / Banner' },
      { type: 'action', text: 'Chọn plan → xác nhận trừ ví' },
      { type: 'decision', text: 'Đủ số dư?' },
      { type: 'action', text: 'Trừ ví + kích hoạt subscription/banner', edgeLabel: 'Đủ' },
      { type: 'action', text: 'Shop/SP hiện public hoặc banner chạy' },
      { type: 'action', text: 'Hết hạn → ẩn shop/SP / dừng banner' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A11 Chat & thông báo',
    id: 'act-chat',
    title: 'Luồng: Chat realtime & thông báo',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Buyer mở chat từ shop/SP\nhoặc vào Inbox' },
      { type: 'action', text: 'Tạo/lấy conversation' },
      { type: 'action', text: 'Gửi text/ảnh qua socket' },
      { type: 'action', text: 'Peer nhận realtime + badge unread' },
      { type: 'action', text: 'Sự kiện hệ thống → notification\n(buyer/seller audience)' },
      { type: 'action', text: 'User đọc / đánh dấu đã đọc' },
      { type: 'end' },
    ],
  }),
  buildActivityPage({
    name: 'A12 Admin vận hành',
    id: 'act-admin',
    title: 'Luồng: Admin quản trị chính',
    steps: [
      { type: 'start' },
      { type: 'action', text: 'Admin đăng nhập web' },
      { type: 'action', text: 'Dashboard → chọn module' },
      { type: 'action', text: 'Duyệt seller / rút tiền / report / dispute' },
      { type: 'action', text: 'Quản lý catalog, gói, banner, NH' },
      { type: 'action', text: 'Gửi thông báo hệ thống' },
      { type: 'action', text: 'Ghi audit log' },
      { type: 'end' },
    ],
  }),
]);

const files = {
  '01-UC-Tong-quan.drawio': ucTong,
  '02-UC-Auth.drawio': ucAuth,
  '03-UC-Buyer.drawio': ucBuyer,
  '04-UC-Seller.drawio': ucSeller,
  '05-UC-Vi-Goi-Banner.drawio': ucWallet,
  '06-UC-Admin.drawio': ucAdmin,
};

Object.entries(files).forEach(([name, content]) => {
  fs.writeFileSync(path.join(OUT, name), content, 'utf8');
  console.log('Wrote', name);
});

console.log('Use-case diagrams done. For 3-column activities run: node docs/diagrams/generate-activity-swimlanes.js');
