/**
 * Activity 3 cột: Đặt giữ hàng (Buyer) + Chấp nhận giữ hàng (Seller)
 * Run: node docs/diagrams/generate-activity-reservation.js
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

function cell(id, value, x, y, w, h, style) {
  return `<mxCell id="${id}" value="${esc(value)}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>
        </mxCell>`;
}

function edge(id, source, target, label = '') {
  const value = label ? ` value="${esc(label)}"` : '';
  return `<mxCell id="${id}"${value} style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;fontSize=11;fontStyle=1;" edge="1" parent="1" source="${source}" target="${target}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

const S = {
  lane: 'swimlane;horizontal=0;startSize=36;fillColor=#f5f5f5;strokeColor=#666666;fontStyle=1;fontSize=13;whiteSpace=wrap;',
  start: 'ellipse;html=1;shape=startState;fillColor=#000000;strokeColor=#000000;',
  end: 'ellipse;html=1;shape=endState;fillColor=#000000;strokeColor=#000000;',
  action: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;arcSize=40;',
  decision: 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;',
  title: 'text;html=1;strokeColor=none;fillColor=none;align=center;fontStyle=1;fontSize=15;',
};

const COL = {
  user: { cx: 190 },
  app: { cx: 480 },
  sys: { cx: 780 },
};

function buildPage({ name, id, title, lanes, nodes, links }) {
  const labels = lanes || ['Người dùng', 'Ứng dụng', 'Hệ thống'];
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + 120), 400);
  const height = Math.max(1100, maxY + 60);
  const cells = [];
  cells.push(cell(`${id}_title`, title, 180, 8, 620, 28, S.title));
  cells.push(cell(`${id}_L0`, labels[0], 40, 40, 300, height - 60, S.lane));
  cells.push(cell(`${id}_L1`, labels[1], 340, 40, 300, height - 60, S.lane));
  cells.push(cell(`${id}_L2`, labels[2], 640, 40, 300, height - 60, S.lane));

  nodes.forEach((n) => {
    const cx = COL[n.lane].cx;
    if (n.type === 'start' || n.type === 'end') {
      cells.push(cell(n.id, '', cx - 15, n.y, 30, 30, n.type === 'start' ? S.start : S.end));
    } else if (n.type === 'decision') {
      const w = n.w || 160;
      const h = n.h || 72;
      cells.push(cell(n.id, n.text, cx - w / 2, n.y, w, h, S.decision));
    } else {
      const w = n.w || 190;
      const h = n.h || 46;
      cells.push(cell(n.id, n.text, cx - w / 2, n.y, w, h, S.action));
    }
  });

  links.forEach((l, i) => cells.push(edge(`${id}_e${i}`, l.from, l.to, l.label || '')));

  return `  <diagram id="${id}" name="${esc(name)}">
    <mxGraphModel dx="1100" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="980" pageHeight="${height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>`;
}

// ========== 1. BUYER ĐẶT GIỮ HÀNG ==========
const buyerReserve = buildPage({
  name: '01 Buyer đặt giữ hàng',
  id: 'act-buyer-reserve',
  title: 'Luồng: Người mua đặt giữ hàng',
  lanes: ['Người mua', 'Ứng dụng', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 55 },
    { id: 'b1', lane: 'user', type: 'action', text: 'Mở chi tiết sản phẩm', y: 100 },
    { id: 'a1', lane: 'app', type: 'action', text: 'Hiển thị ProductDetail\n(giá, KM, biến thể)', y: 170 },
    { id: 'b2', lane: 'user', type: 'action', text: 'Nhấn «Giữ hàng»', y: 250 },
    { id: 'a2', lane: 'app', type: 'action', text: 'Mở ReservationModal\nLoad biến thể + % cọc shop', y: 320 },
    { id: 'b3', lane: 'user', type: 'action', text: 'Chọn biến thể, số lượng\nNgày/giờ nhận, ghi chú', y: 410 },
    { id: 'a3', lane: 'app', type: 'action', text: 'Validate form\n(tính tiền cọc nếu có)', y: 510 },
    { id: 'd1', lane: 'app', type: 'decision', text: 'Form hợp lệ?', y: 600 },
    { id: 'a4', lane: 'app', type: 'action', text: 'Hiển thị lỗi\n(thiếu giờ / hết hàng…)', y: 710 },
    { id: 'd2', lane: 'sys', type: 'decision', text: 'Shop yêu cầu\ncọc?', y: 710 },
    { id: 'd3', lane: 'sys', type: 'decision', text: 'Số dư ví\nđủ cọc?', y: 820 },
    { id: 'a5', lane: 'app', type: 'action', text: 'Báo thiếu tiền\n→ CTA Nạp ví', y: 930 },
    { id: 'b4', lane: 'user', type: 'action', text: 'Nạp tiền (PayOS)\nquay lại giữ hàng', y: 1020 },
    { id: 'sy1', lane: 'sys', type: 'action', text: 'Trừ ví (DEPOSIT_HOLD)\nTạo reservation\nstatus = Chờ shop xác nhận', y: 930 },
    { id: 'sy2', lane: 'sys', type: 'action', text: 'Tạo reservation\n(không cọc)\nstatus = Chờ shop xác nhận', y: 930 },
    { id: 'sy3', lane: 'sys', type: 'action', text: 'Giảm tồn tạm / khóa SL\nGửi notify Seller', y: 1060 },
    { id: 'a6', lane: 'app', type: 'action', text: 'Đóng modal\nHiện đơn trong Đơn hàng\n(Chờ shop xác nhận)', y: 1160 },
    { id: 'e', lane: 'user', type: 'end', y: 1260 },
  ],
  links: [
    { from: 's', to: 'b1' },
    { from: 'b1', to: 'a1' },
    { from: 'a1', to: 'b2' },
    { from: 'b2', to: 'a2' },
    { from: 'a2', to: 'b3' },
    { from: 'b3', to: 'a3' },
    { from: 'a3', to: 'd1' },
    { from: 'd1', to: 'a4', label: 'Không' },
    { from: 'a4', to: 'b3' },
    { from: 'd1', to: 'd2', label: 'Có' },
    { from: 'd2', to: 'd3', label: 'Có' },
    { from: 'd2', to: 'sy2', label: 'Không' },
    { from: 'd3', to: 'sy1', label: 'Đủ' },
    { from: 'd3', to: 'a5', label: 'Thiếu' },
    { from: 'a5', to: 'b4' },
    { from: 'b4', to: 'a3' },
    { from: 'sy1', to: 'sy3' },
    { from: 'sy2', to: 'sy3' },
    { from: 'sy3', to: 'a6' },
    { from: 'a6', to: 'e' },
  ],
});

// ========== 2. SELLER CHẤP NHẬN GIỮ HÀNG ==========
const sellerAccept = buildPage({
  name: '02 Seller chấp nhận giữ hàng',
  id: 'act-seller-accept',
  title: 'Luồng: Người bán chấp nhận / từ chối giữ hàng',
  lanes: ['Người bán', 'Ứng dụng', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 55 },
    { id: 'sy0', lane: 'sys', type: 'action', text: 'Có đơn mới PENDING\nPush / socket notify', y: 100 },
    { id: 'a1', lane: 'app', type: 'action', text: 'Hiện badge Đơn bán\nDanh sách chờ xác nhận', y: 190 },
    { id: 'u1', lane: 'user', type: 'action', text: 'Mở Đơn bán\n→ Chi tiết đơn', y: 280 },
    { id: 'a2', lane: 'app', type: 'action', text: 'Hiển thị: SP, SL, giờ nhận\nBuyer, cọc (nếu có)', y: 360 },
    { id: 'd1', lane: 'user', type: 'decision', text: 'Xử lý?', y: 460 },
    { id: 'u2', lane: 'user', type: 'action', text: 'Nhấn «Đồng ý giữ hàng»\nXác nhận dialog', y: 570 },
    { id: 'u3', lane: 'user', type: 'action', text: 'Nhấn «Từ chối»\nXác nhận dialog', y: 570 },
    { id: 'a3', lane: 'app', type: 'action', text: 'Gọi API confirm', y: 680 },
    { id: 'a4', lane: 'app', type: 'action', text: 'Gọi API reject', y: 680 },
    { id: 'sy1', lane: 'sys', type: 'action', text: 'Đổi status →\nChờ nhận hàng (WAITING)\nGiữ cọc (nếu có)', y: 780 },
    { id: 'sy2', lane: 'sys', type: 'action', text: 'Đổi status → Từ chối\nHoàn cọc ví buyer\nTrả tồn kho', y: 780 },
    { id: 'sy3', lane: 'sys', type: 'action', text: 'Notify Buyer\n(đã chấp nhận / từ chối)', y: 900 },
    { id: 'a5', lane: 'app', type: 'action', text: 'Cập nhật UI đơn\nSeller: chờ khách đến\nđưa QR khi nhận', y: 1000 },
    { id: 'a6', lane: 'app', type: 'action', text: 'Cập nhật UI\nĐơn đã từ chối', y: 1000 },
    { id: 'e1', lane: 'user', type: 'end', y: 1100 },
    { id: 'e2', lane: 'user', type: 'end', y: 1100 },
  ],
  links: [
    { from: 's', to: 'sy0' },
    { from: 'sy0', to: 'a1' },
    { from: 'a1', to: 'u1' },
    { from: 'u1', to: 'a2' },
    { from: 'a2', to: 'd1' },
    { from: 'd1', to: 'u2', label: 'Đồng ý' },
    { from: 'd1', to: 'u3', label: 'Từ chối' },
    { from: 'u2', to: 'a3' },
    { from: 'u3', to: 'a4' },
    { from: 'a3', to: 'sy1' },
    { from: 'a4', to: 'sy2' },
    { from: 'sy1', to: 'sy3' },
    { from: 'sy2', to: 'sy3' },
    { from: 'sy3', to: 'a5' },
    { from: 'sy3', to: 'a6' },
    { from: 'a5', to: 'e1' },
    { from: 'a6', to: 'e2' },
  ],
});

const xml = `<mxfile host="app.diagrams.net" modified="2026-07-24T04:00:00.000Z" agent="FastMark" version="22.1.0" type="device">
${buyerReserve}
${sellerAccept}
</mxfile>
`;

const out = path.join(OUT, '11-Activity-Dat-va-Chap-nhan-giu-hang.drawio');
fs.writeFileSync(out, xml, 'utf8');
console.log('Wrote', path.basename(out));

// Also append into buyer/seller multi-page files if they exist — regenerate by merging is heavy;
// document in README instead.
const readmePath = path.join(OUT, 'README.md');
let readme = '';
try {
  readme = fs.readFileSync(readmePath, 'utf8');
} catch {
  readme = '# FastMark diagrams\n';
}
if (!readme.includes('11-Activity-Dat-va-Chap-nhan-giu-hang')) {
  readme += `
## Giữ hàng (chi tiết)
| File | Trang |
|------|-------|
| \`11-Activity-Dat-va-Chap-nhan-giu-hang.drawio\` | 1) Buyer đặt giữ hàng  2) Seller chấp nhận / từ chối |

\`\`\`bash
node docs/diagrams/generate-activity-reservation.js
\`\`\`
`;
  fs.writeFileSync(readmePath, readme, 'utf8');
  console.log('Updated README.md');
}
