/**
 * FastMark Activity diagrams — 3 cột swimlane:
 * Người dùng | Ứng dụng | Hệ thống
 * (Admin: Admin | Ứng dụng Web | Hệ thống)
 *
 * Run: node docs/diagrams/generate-activity-swimlanes.js
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
  fork: 'line;strokeWidth=6;html=1;fillColor=#000000;strokeColor=#000000;',
  title: 'text;html=1;strokeColor=none;fillColor=none;align=center;fontStyle=1;fontSize=15;',
};

const COL = {
  user: { x: 60, w: 260, cx: 190 },
  app: { x: 340, w: 280, cx: 480 },
  sys: { x: 640, w: 280, cx: 780 },
};

function colMeta(lane) {
  if (lane === 'user') return COL.user;
  if (lane === 'app') return COL.app;
  return COL.sys;
}

/**
 * nodes: [{ id, lane:'user'|'app'|'sys', type:'start'|'end'|'action'|'decision'|'fork', text?, w?, h? }]
 * links: [{ from, to, label? }]
 * lanes?: [labelUser, labelApp, labelSys]
 */
function buildSwimPage({ name, id, title, nodes, links, lanes }) {
  const laneLabels = lanes || ['Người dùng', 'Ứng dụng', 'Hệ thống'];
  const maxY = nodes.reduce((m, n) => Math.max(m, (n.y || 0) + 100), 200);
  const height = Math.max(900, maxY + 80);
  const width = 980;
  const cells = [];

  cells.push(cell(`${id}_title`, title, 200, 8, 560, 28, S.title));

  // 3 vertical swimlanes
  cells.push(cell(`${id}_L0`, laneLabels[0], 40, 40, 300, height - 60, S.lane));
  cells.push(cell(`${id}_L1`, laneLabels[1], 340, 40, 300, height - 60, S.lane));
  cells.push(cell(`${id}_L2`, laneLabels[2], 640, 40, 300, height - 60, S.lane));

  nodes.forEach((n) => {
    const col = colMeta(n.lane);
    const y = n.y;
    if (n.type === 'start' || n.type === 'end') {
      cells.push(cell(n.id, '', col.cx - 15, y, 30, 30, n.type === 'start' ? S.start : S.end));
    } else if (n.type === 'decision') {
      const w = n.w || 150;
      const h = n.h || 70;
      cells.push(cell(n.id, n.text || '', col.cx - w / 2, y, w, h, S.decision));
    } else if (n.type === 'fork') {
      cells.push(cell(n.id, '', col.x + 30, y, col.w - 60, 8, S.fork));
    } else {
      const w = n.w || 180;
      const h = n.h || 44;
      cells.push(cell(n.id, n.text || '', col.cx - w / 2, y, w, h, S.action));
    }
  });

  links.forEach((l, i) => {
    cells.push(edge(`${id}_e${i}`, l.from, l.to, l.label || ''));
  });

  return `  <diagram id="${id}" name="${esc(name)}">
    <mxGraphModel dx="1100" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>`;
}

function mxfile(pages) {
  return `<mxfile host="app.diagrams.net" modified="2026-07-24T02:30:00.000Z" agent="FastMark" version="22.1.0" type="device">
${pages.join('\n')}
</mxfile>
`;
}

// ========== FLOW DEFINITIONS ==========
// y spacing ~70-90 between steps

const flows = [];

// --- AUTH ---
flows.push({
  fileGroup: 'buyer',
  name: '01 Auth đăng nhập',
  id: 'act-login',
  title: 'Đăng nhập email / Google',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở app', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Hiển thị màn Auth', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Chọn Email hoặc Google', y: 250 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Gửi yêu cầu đăng nhập', y: 320 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Xác thực Firebase\n(+ Google token)', y: 390 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Hợp lệ?', y: 480 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Load / tạo profile', y: 580 },
    { id: 'd2', lane: 'sys', type: 'decision', text: 'Google thiếu\nusername?', y: 670 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Màn setup username', y: 770 },
    { id: 'n8', lane: 'user', type: 'action', text: 'Nhập username', y: 850 },
    { id: 'n9', lane: 'app', type: 'action', text: 'Vào AuthenticatedHome', y: 930 },
    { id: 'n10', lane: 'app', type: 'action', text: 'Hiển thị lỗi', y: 580 },
    { id: 'e', lane: 'user', type: 'end', y: 1010 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'd1' },
    { from: 'd1', to: 'n6', label: 'Có' },
    { from: 'd1', to: 'n10', label: 'Không' },
    { from: 'n10', to: 'n3' },
    { from: 'n6', to: 'd2' },
    { from: 'd2', to: 'n7', label: 'Có' },
    { from: 'd2', to: 'n9', label: 'Không' },
    { from: 'n7', to: 'n8' },
    { from: 'n8', to: 'n9' },
    { from: 'n9', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '02 Đăng ký email',
  id: 'act-register',
  title: 'Đăng ký tài khoản email',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Nhập email, MK, họ tên...', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Validate form\nGửi đăng ký', y: 190 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Tạo user Firebase\n+ profile backend', y: 270 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Cần xác thực\nemail?', y: 360 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Màn OTP email', y: 460 },
    { id: 'n5', lane: 'user', type: 'action', text: 'Nhập OTP', y: 540 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Xác nhận OTP', y: 620 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Vào trang chủ', y: 700 },
    { id: 'e', lane: 'user', type: 'end', y: 780 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'd1' },
    { from: 'd1', to: 'n4', label: 'Có' },
    { from: 'd1', to: 'n7', label: 'Không' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '03 Quên mật khẩu',
  id: 'act-forgot',
  title: 'Quên mật khẩu (OTP)',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Nhập email quên MK', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Gửi yêu cầu OTP', y: 180 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Gửi OTP email', y: 250 },
    { id: 'n4', lane: 'user', type: 'action', text: 'Nhập OTP + MK mới', y: 330 },
    { id: 'n5', lane: 'sys', type: 'decision', text: 'OTP đúng?', y: 420 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Cập nhật mật khẩu', y: 520 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Về màn Login', y: 600 },
    { id: 'n8', lane: 'app', type: 'action', text: 'Báo OTP sai', y: 520 },
    { id: 'e', lane: 'user', type: 'end', y: 680 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6', label: 'Có' },
    { from: 'n5', to: 'n8', label: 'Không' },
    { from: 'n8', to: 'n4' },
    { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '04 Tìm kiếm',
  id: 'act-search',
  title: 'Tìm kiếm SP / người dùng + lịch sử',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở tìm kiếm', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Hiện lịch sử theo nick\n(5 gần nhất)', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Gõ từ khóa', y: 260 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Gọi gợi ý SP + shop', y: 330 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Match bỏ dấu +\nsort theo khoảng cách', y: 410 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Hiện gợi ý', y: 500 },
    { id: 'n7', lane: 'user', type: 'action', text: 'Enter / chọn gợi ý', y: 580 },
    { id: 'n8', lane: 'sys', type: 'action', text: 'Lưu lịch sử nick\nTrả KQ gần→xa', y: 660 },
    { id: 'n9', lane: 'app', type: 'action', text: 'Tab Tất cả / SP /\nNgười dùng', y: 750 },
    { id: 'e', lane: 'user', type: 'end', y: 840 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'n8' },
    { from: 'n8', to: 'n9' },
    { from: 'n9', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '05 Xem shop sản phẩm',
  id: 'act-browse',
  title: 'Xem gian hàng / sản phẩm',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Chọn shop hoặc SP\n(Home/Map/Search)', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Gọi API chi tiết', y: 200 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Lấy shop/SP +\nKM + khoảng cách', y: 280 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Hiển thị StoreDetail /\nProductDetail', y: 370 },
    { id: 'n5', lane: 'user', type: 'action', text: 'Follow / Tym /\nChat / Giữ hàng', y: 460 },
    { id: 'e', lane: 'user', type: 'end', y: 550 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '06 Giữ hàng và cọc',
  id: 'act-reserve',
  title: 'Giữ hàng (reservation) + cọc ví',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Nhấn Giữ hàng', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Mở ReservationModal', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Chọn biến thể, SL,\n giờ nhận', y: 250 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Gửi tạo reservation', y: 340 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Shop yêu cầu\ncọc?', y: 420 },
    { id: 'd2', lane: 'sys', type: 'decision', text: 'Đủ số dư ví?', y: 520 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Trừ ví + tạo đơn', y: 620 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Tạo đơn không cọc', y: 620 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Báo thiếu tiền /\nđề nghị nạp', y: 620 },
    { id: 'n8', lane: 'sys', type: 'action', text: 'Notify seller +\ncập nhật tồn tạm', y: 720 },
    { id: 'n9', lane: 'app', type: 'action', text: 'Hiện đơn mua', y: 800 },
    { id: 'e', lane: 'user', type: 'end', y: 880 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'd1' },
    { from: 'd1', to: 'd2', label: 'Có' },
    { from: 'd1', to: 'n6', label: 'Không' },
    { from: 'd2', to: 'n5', label: 'Đủ' },
    { from: 'd2', to: 'n7', label: 'Thiếu' },
    { from: 'n5', to: 'n8' },
    { from: 'n6', to: 'n8' },
    { from: 'n7', to: 'n3' },
    { from: 'n8', to: 'n9' },
    { from: 'n9', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '07 QR nhận hàng',
  id: 'act-qr',
  title: 'Quét QR xác nhận nhận hàng',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở đơn → Quét QR', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Mở camera quét', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Quét QR shop\n(seller hiện QR)', y: 250 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Gửi mã QR +\nreservationId', y: 340 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'QR khớp shop\n& đơn hợp lệ?', y: 430 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Confirm received\nQuyết toán cọc', y: 540 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Mời đánh giá', y: 630 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Báo QR không hợp lệ', y: 540 },
    { id: 'e', lane: 'user', type: 'end', y: 720 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'd1' },
    { from: 'd1', to: 'n5', label: 'Có' },
    { from: 'd1', to: 'n7', label: 'Không' },
    { from: 'n7', to: 'n2' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '08 Đánh giá đơn',
  id: 'act-review',
  title: 'Đánh giá sau đơn hoàn thành',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Chọn đánh giá đơn', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Mở ShopReviewModal', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Chọn sao + nội dung\n(+ ảnh)', y: 250 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Gửi review', y: 340 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Lưu review +\ncập nhật rating shop', y: 420 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Hiện đã đánh giá', y: 510 },
    { id: 'e', lane: 'user', type: 'end', y: 590 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '09 Chat',
  id: 'act-chat',
  title: 'Chat realtime với shop',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Nhắn tin từ shop/SP\nhoặc Inbox', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Mở ChatScreen', y: 200 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Tạo/lấy conversation', y: 280 },
    { id: 'n4', lane: 'user', type: 'action', text: 'Gửi text / ảnh', y: 360 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Lưu tin + socket\nđẩy realtime', y: 440 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Peer hiện tin +\nbadge unread', y: 530 },
    { id: 'e', lane: 'user', type: 'end', y: 620 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '10 Nạp tiền PayOS',
  id: 'act-topup',
  title: 'Nạp tiền ví qua PayOS',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Ví → Nạp tiền\nNhập số tiền', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Tạo yêu cầu nạp', y: 200 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Tạo order +\nlink PayOS', y: 280 },
    { id: 'n4', lane: 'user', type: 'action', text: 'Thanh toán trên PayOS', y: 370 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Webhook / sync\ntrạng thái', y: 460 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Thành công?', y: 550 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Cộng số dư ví\n+ transaction', y: 650 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Màn TopUp Success', y: 740 },
    { id: 'n8', lane: 'app', type: 'action', text: 'Báo thất bại', y: 650 },
    { id: 'e', lane: 'user', type: 'end', y: 830 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'd1' },
    { from: 'd1', to: 'n6', label: 'Có' },
    { from: 'd1', to: 'n8', label: 'Không' },
    { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'e' },
    { from: 'n8', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '11 Rút tiền',
  id: 'act-withdraw',
  title: 'Rút tiền (chờ Admin duyệt)',
  lanes: ['Người dùng', 'Ứng dụng', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Tạo yêu cầu rút +\nchọn ngân hàng', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Gửi withdraw request', y: 200 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Khóa số dư chờ duyệt', y: 280 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Chờ Admin xử lý\n(xem luồng Admin)', y: 370 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Thông báo kết quả', y: 460 },
    { id: 'e', lane: 'user', type: 'end', y: 550 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'buyer',
  name: '12 Báo cáo tranh chấp',
  id: 'act-dispute',
  title: 'Báo cáo / tranh chấp đơn',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở đơn → Báo cáo', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Form lý do + ảnh\n(+ GPS nếu cần)', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Gửi tố cáo', y: 270 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Lưu report/dispute\nNotify Admin', y: 350 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Xác nhận đã gửi', y: 440 },
    { id: 'e', lane: 'user', type: 'end', y: 520 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
  ],
});

// --- SELLER REG (match reference image closely) ---
flows.push({
  fileGroup: 'seller',
  name: '01 Đăng ký gian hàng',
  id: 'act-seller-reg',
  title: 'Đăng ký người bán → chờ duyệt',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 50 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Đăng nhập', y: 100 },
    { id: 'n2', lane: 'user', type: 'action', text: 'Chọn đăng ký bán hàng', y: 170 },
    { id: 'n3', lane: 'app', type: 'action', text: 'Gửi yêu cầu kiểm tra hồ sơ', y: 240 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Đã là\nngười bán?', y: 320 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Hiển thị màn\ngian hàng', y: 420 },
    { id: 'd2', lane: 'sys', type: 'decision', text: 'Đã xác thực\nSĐT?', y: 420 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Hiển thị màn thêm SĐT', y: 530 },
    { id: 'n6', lane: 'user', type: 'action', text: 'Xác thực SĐT (OTP)', y: 610 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Hiển thị màn đăng ký', y: 700 },
    { id: 'f1', lane: 'user', type: 'fork', y: 780 },
    { id: 'p1', lane: 'user', type: 'action', text: 'CCCD mặt trước', y: 820, w: 150, h: 36 },
    { id: 'p2', lane: 'user', type: 'action', text: 'CCCD mặt sau', y: 870, w: 150, h: 36 },
    { id: 'p3', lane: 'user', type: 'action', text: 'Ảnh chân dung', y: 920, w: 150, h: 36 },
    { id: 'p4', lane: 'user', type: 'action', text: 'Danh mục', y: 970, w: 150, h: 36 },
    { id: 'p5', lane: 'user', type: 'action', text: 'Vị trí', y: 1020, w: 150, h: 36 },
    { id: 'f2', lane: 'user', type: 'fork', y: 1080 },
    { id: 'n8', lane: 'user', type: 'action', text: 'Nhấn đăng ký', y: 1120 },
    { id: 'd3', lane: 'app', type: 'decision', text: 'Thông tin\nhợp lệ?', y: 1200 },
    { id: 'n9', lane: 'app', type: 'action', text: 'Hiển thị thông báo lỗi', y: 1310 },
    { id: 'n10', lane: 'sys', type: 'action', text: 'Tạo phiếu đăng ký\n(PENDING)', y: 1310 },
    { id: 'n11', lane: 'app', type: 'action', text: 'Màn chờ duyệt hồ sơ', y: 1410 },
    { id: 'e', lane: 'user', type: 'end', y: 1500 },
    { id: 'e2', lane: 'user', type: 'end', y: 520 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'd1' },
    { from: 'd1', to: 'n4', label: 'Có' },
    { from: 'd1', to: 'd2', label: 'Không' },
    { from: 'n4', to: 'e2' },
    { from: 'd2', to: 'n5', label: 'Không' },
    { from: 'd2', to: 'n7', label: 'Có' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'f1' },
    { from: 'f1', to: 'p1' },
    { from: 'f1', to: 'p2' },
    { from: 'f1', to: 'p3' },
    { from: 'f1', to: 'p4' },
    { from: 'f1', to: 'p5' },
    { from: 'p1', to: 'f2' },
    { from: 'p2', to: 'f2' },
    { from: 'p3', to: 'f2' },
    { from: 'p4', to: 'f2' },
    { from: 'p5', to: 'f2' },
    { from: 'f2', to: 'n8' },
    { from: 'n8', to: 'd3' },
    { from: 'd3', to: 'n9', label: 'Không' },
    { from: 'd3', to: 'n10', label: 'Có' },
    { from: 'n9', to: 'n7' },
    { from: 'n10', to: 'n11' },
    { from: 'n11', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'seller',
  name: '02 Cài đặt shop',
  id: 'act-shop-settings',
  title: 'Cài đặt gian hàng (bio, giờ, cọc, QR)',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Cài đặt shop', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Load shop settings', y: 180 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Trả về hồ sơ shop', y: 260 },
    { id: 'n4', lane: 'user', type: 'action', text: 'Sửa bio, giờ, % cọc,\nđịa chỉ, mở/đóng', y: 340 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Lưu thay đổi', y: 440 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Cập nhật ShopProfile', y: 520 },
    { id: 'n7', lane: 'app', type: 'action', text: 'Xác nhận đã lưu', y: 600 },
    { id: 'e', lane: 'user', type: 'end', y: 680 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'seller',
  name: '03 Đăng sản phẩm',
  id: 'act-post-product',
  title: 'Đăng / sửa sản phẩm',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Đăng tin', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Form SP + biến thể', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Nhập tên, DM, ảnh,\nđơn vị, biến thể, giá', y: 250 },
    { id: 'n4', lane: 'user', type: 'action', text: '(Tuỳ chọn) bật % KM', y: 350 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Validate + gửi API', y: 430 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Gói bán\nđang active?', y: 520 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Lưu SP (public)', y: 630 },
    { id: 'n7', lane: 'sys', type: 'action', text: 'Lưu SP (ẩn công khai)', y: 630 },
    { id: 'n8', lane: 'app', type: 'action', text: 'Thông báo thành công', y: 720 },
    { id: 'e', lane: 'user', type: 'end', y: 800 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'd1' },
    { from: 'd1', to: 'n6', label: 'Có' },
    { from: 'd1', to: 'n7', label: 'Không' },
    { from: 'n6', to: 'n8' },
    { from: 'n7', to: 'n8' },
    { from: 'n8', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'seller',
  name: '04 Khuyến mãi và ghim',
  id: 'act-promo-pin',
  title: 'Khuyến mãi & ghim sản phẩm',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Chọn SP → KM hoặc Ghim', y: 110 },
    { id: 'd0', lane: 'user', type: 'decision', text: 'Loại thao tác?', y: 190 },
    { id: 'n2', lane: 'user', type: 'action', text: 'Nhập % + ngày KM\n(hoặc bulk)', y: 290 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Chọn vị trí ghim 1/2', y: 290 },
    { id: 'n4', lane: 'app', type: 'action', text: 'Gửi API pin/promo', y: 390 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Cập nhật pin/KM\n(đẩy/đá slot nếu cần)', y: 480 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Refresh danh sách SP', y: 580 },
    { id: 'e', lane: 'user', type: 'end', y: 660 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'd0' },
    { from: 'd0', to: 'n2', label: 'KM' },
    { from: 'd0', to: 'n3', label: 'Ghim' },
    { from: 'n2', to: 'n4' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'seller',
  name: '05 Quản lý đơn bán',
  id: 'act-seller-orders',
  title: 'Seller xử lý đơn bán',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'sys', type: 'action', text: 'Đơn mới → notify', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Hiện Đơn bán', y: 190 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Xem chi tiết đơn', y: 270 },
    { id: 'd1', lane: 'user', type: 'decision', text: 'Thao tác?', y: 350 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Confirm / Reject /\nCancel / Báo no-show', y: 460 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Cập nhật trạng thái\n+ cọc / tồn kho', y: 570 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Cập nhật UI +\nnotify buyer', y: 670 },
    { id: 'e', lane: 'user', type: 'end', y: 760 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'd1' },
    { from: 'd1', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'seller',
  name: '06 Mua gói bán',
  id: 'act-subscription',
  title: 'Mua gói bán (subscription) bằng ví',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Gói bán → chọn plan', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Xác nhận trừ ví', y: 190 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Đủ số dư?', y: 270 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Trừ ví + kích hoạt\nsubscription', y: 380 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Shop/SP hiện public', y: 480 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Hiện hạn gói', y: 570 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Báo thiếu tiền\n→ nạp ví', y: 380 },
    { id: 'e', lane: 'user', type: 'end', y: 660 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'd1' },
    { from: 'd1', to: 'n3', label: 'Có' },
    { from: 'd1', to: 'n6', label: 'Không' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'seller',
  name: '07 Mua banner',
  id: 'act-banner',
  title: 'Mua & cấu hình banner',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Banner → chọn gói', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Trừ ví mua plan', y: 190 },
    { id: 'd1', lane: 'sys', type: 'decision', text: 'Thanh toán OK?', y: 270 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Upload ảnh +\nchọn target', y: 380 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Lưu banner active', y: 480 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Banner hiện Home buyer', y: 570 },
    { id: 'n6', lane: 'app', type: 'action', text: 'Báo lỗi / thiếu tiền', y: 380 },
    { id: 'e', lane: 'user', type: 'end', y: 660 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'd1' },
    { from: 'd1', to: 'n3', label: 'Có' },
    { from: 'd1', to: 'n6', label: 'Không' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'seller',
  name: '08 Quản lý đánh giá',
  id: 'act-seller-reviews',
  title: 'Xem & báo cáo đánh giá',
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Quản lý đánh giá', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Load reviews shop', y: 180 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Trả danh sách ĐG', y: 260 },
    { id: 'n4', lane: 'user', type: 'action', text: 'Xem / Báo cáo ĐG xấu', y: 340 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Lưu report → Admin', y: 430 },
    { id: 'e', lane: 'user', type: 'end', y: 520 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
  ],
});

// --- ADMIN ---
flows.push({
  fileGroup: 'admin',
  name: '01 Duyệt seller',
  id: 'act-admin-seller',
  title: 'Admin duyệt hồ sơ người bán',
  lanes: ['Admin', 'Ứng dụng Web', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Đăng nhập Admin', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Mở Seller Verifications', y: 180 },
    { id: 'n3', lane: 'sys', type: 'action', text: 'Load hồ sơ PENDING', y: 260 },
    { id: 'n4', lane: 'user', type: 'action', text: 'Xem CCCD / selfie /\nvị trí', y: 340 },
    { id: 'd1', lane: 'user', type: 'decision', text: 'Duyệt?', y: 440 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Approve → role Seller\n+ tạo ShopProfile', y: 550 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Reject + lý do', y: 550 },
    { id: 'n7', lane: 'sys', type: 'action', text: 'Notify user +\naudit log', y: 660 },
    { id: 'e', lane: 'user', type: 'end', y: 750 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'd1' },
    { from: 'd1', to: 'n5', label: 'Duyệt' },
    { from: 'd1', to: 'n6', label: 'Từ chối' },
    { from: 'n5', to: 'n7' },
    { from: 'n6', to: 'n7' },
    { from: 'n7', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'admin',
  name: '02 Duyệt rút tiền',
  id: 'act-admin-withdraw',
  title: 'Admin duyệt rút tiền',
  lanes: ['Admin', 'Ứng dụng Web', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Withdrawals', y: 110 },
    { id: 'n2', lane: 'sys', type: 'action', text: 'Danh sách yêu cầu\nchờ duyệt', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Xem user + NH +\nsố tiền', y: 270 },
    { id: 'd1', lane: 'user', type: 'decision', text: 'Duyệt?', y: 370 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Approve → hoàn tất\nrút / trừ giữ', y: 480 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Reject → hoàn số dư', y: 480 },
    { id: 'n6', lane: 'sys', type: 'action', text: 'Notify user', y: 580 },
    { id: 'e', lane: 'user', type: 'end', y: 660 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'd1' },
    { from: 'd1', to: 'n4', label: 'Duyệt' },
    { from: 'd1', to: 'n5', label: 'Từ chối' },
    { from: 'n4', to: 'n6' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'admin',
  name: '03 Xử lý báo cáo tranh chấp',
  id: 'act-admin-report',
  title: 'Admin xử lý report / dispute',
  lanes: ['Admin', 'Ứng dụng Web', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Reports / Disputes', y: 110 },
    { id: 'n2', lane: 'sys', type: 'action', text: 'Load hồ sơ tố cáo', y: 180 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Xem bằng chứng\nra quyết định', y: 260 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Cập nhật trạng thái\nđơn / cọc / khóa TK', y: 360 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Notify các bên +\naudit', y: 460 },
    { id: 'e', lane: 'user', type: 'end', y: 550 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'admin',
  name: '04 Quản lý catalog gói',
  id: 'act-admin-catalog',
  title: 'Admin quản lý danh mục / gói / NH / thông báo',
  lanes: ['Admin', 'Ứng dụng Web', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Chọn module:\nDM / Plan / Banner /\nNH / Notify', y: 110 },
    { id: 'n2', lane: 'app', type: 'action', text: 'Form CRUD', y: 210 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Thêm / sửa / xóa /\ngửi thông báo HT', y: 290 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Lưu DB + đẩy app\n(nếu notify)', y: 390 },
    { id: 'n5', lane: 'app', type: 'action', text: 'Xác nhận + audit log', y: 490 },
    { id: 'e', lane: 'user', type: 'end', y: 580 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
  ],
});

flows.push({
  fileGroup: 'admin',
  name: '05 Quản lý tài khoản shop',
  id: 'act-admin-accounts',
  title: 'Admin quản lý tài khoản / shop / sản phẩm',
  lanes: ['Admin', 'Ứng dụng Web', 'Hệ thống'],
  nodes: [
    { id: 's', lane: 'user', type: 'start', y: 60 },
    { id: 'n1', lane: 'user', type: 'action', text: 'Mở Accounts / Shops /\nProducts', y: 110 },
    { id: 'n2', lane: 'sys', type: 'action', text: 'Trả danh sách', y: 200 },
    { id: 'n3', lane: 'user', type: 'action', text: 'Khóa TK / ẩn shop /\ngỡ SP vi phạm', y: 280 },
    { id: 'n4', lane: 'sys', type: 'action', text: 'Áp dụng trạng thái', y: 380 },
    { id: 'n5', lane: 'sys', type: 'action', text: 'Ghi audit log', y: 460 },
    { id: 'e', lane: 'user', type: 'end', y: 540 },
  ],
  links: [
    { from: 's', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'e' },
  ],
});

// Write files
const groups = {
  buyer: [],
  seller: [],
  admin: [],
};

flows.forEach((f) => {
  groups[f.fileGroup].push(
    buildSwimPage({
      name: f.name,
      id: f.id,
      title: f.title,
      nodes: f.nodes,
      links: f.links,
      lanes: f.lanes,
    })
  );
});

const outFiles = {
  '08-Activity-Buyer-3cot.drawio': mxfile(groups.buyer),
  '09-Activity-Seller-3cot.drawio': mxfile(groups.seller),
  '10-Activity-Admin-3cot.drawio': mxfile(groups.admin),
};

Object.entries(outFiles).forEach(([name, xml]) => {
  fs.writeFileSync(path.join(OUT, name), xml, 'utf8');
  console.log('Wrote', name, `(${xml.length} bytes)`);
});

// Remove old single-column activity if exists — keep UC files
const oldAct = path.join(OUT, '07-Activity-Cac-luong-chinh.drawio');
if (fs.existsSync(oldAct)) {
  fs.unlinkSync(oldAct);
  console.log('Removed old 07-Activity-Cac-luong-chinh.drawio');
}

const readme = `# FastMark – Sơ đồ Use Case & Activity (.drawio)

Mở bằng [app.diagrams.net](https://app.diagrams.net) / Draw.io Desktop.

## Use Case
| File | Nội dung |
|------|----------|
| \`01-UC-Tong-quan.drawio\` | UC tổng hệ thống |
| \`02-UC-Auth.drawio\` | Auth |
| \`03-UC-Buyer.drawio\` | Full Buyer |
| \`04-UC-Seller.drawio\` | Full Seller |
| \`05-UC-Vi-Goi-Banner.drawio\` | Ví / gói / banner |
| \`06-UC-Admin.drawio\` | Admin quản lý tất cả |

## Activity — 3 cột (Người dùng | Ứng dụng | Hệ thống)
Kiểu swimlane giống mẫu đăng ký gian hàng.

| File | Số trang | Nội dung |
|------|----------|----------|
| \`08-Activity-Buyer-3cot.drawio\` | 12 | Auth, quên MK, search, xem SP/shop, giữ hàng+cọc, QR, đánh giá, chat, nạp PayOS, rút tiền, tranh chấp |
| \`09-Activity-Seller-3cot.drawio\` | 8 | Đăng ký bán (fork CCCD), cài shop, đăng SP, KM+ghim, đơn bán, gói bán, banner, quản lý ĐG |
| \`10-Activity-Admin-3cot.drawio\` | 5 | Duyệt seller, duyệt rút tiền, report/dispute, catalog/gói/NH/notify, khóa TK/shop/SP |

> Admin dùng nhãn cột: **Admin | Ứng dụng Web | Hệ thống**

## Tái tạo
\`\`\`bash
node docs/diagrams/generate-drawio.js
node docs/diagrams/generate-activity-swimlanes.js
\`\`\`
`;

fs.writeFileSync(path.join(OUT, 'README.md'), readme, 'utf8');
console.log('Updated README.md');
console.log('Total flows:', flows.length);
