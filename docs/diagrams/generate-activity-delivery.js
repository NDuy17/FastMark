/**
 * Activity giao nhận hàng — 1 trang swimlane:
 * Người mua | Người bán | Hệ thống
 *
 * Bao gồm:
 * - Seller hủy sau xác nhận (lý do + ảnh → hoàn cọc)
 * - Trước giờ: quét QR → COMPLETED
 * - Sau giờ: buyer forfeit / báo seller · seller tố no-show · hết 24h / admin
 *
 * Run: node docs/diagrams/generate-activity-delivery.js
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
  return `<mxCell id="${id}"${value} style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;fontSize=10;fontStyle=1;" edge="1" parent="1" source="${source}" target="${target}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

const S = {
  lane: 'swimlane;horizontal=0;startSize=44;fillColor=#f5f5f5;strokeColor=#666666;fontStyle=1;fontSize=14;whiteSpace=wrap;',
  start: 'ellipse;html=1;shape=startState;fillColor=#000000;strokeColor=#000000;',
  end: 'ellipse;html=1;shape=endState;fillColor=#000000;strokeColor=#000000;',
  actionB: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;arcSize=40;',
  actionS: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=11;arcSize=40;',
  actionY: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=11;arcSize=40;',
  decision: 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;',
  merge: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f5f5f5;strokeColor=#666666;fontSize=11;fontStyle=1;',
  note: 'rounded=0;whiteSpace=wrap;html=1;fillColor=#fff9e6;strokeColor=#d6b656;fontSize=10;align=left;spacingLeft=6;',
  title: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontStyle=1;fontSize=15;',
  legend: 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#999999;fontSize=10;align=left;spacingLeft=8;',
};

/** Tâm cột theo lane */
const CX = { buyer: 210, seller: 560, sys: 910 };

function styleFor(n) {
  if (n.type === 'start') return S.start;
  if (n.type === 'end') return S.end;
  if (n.type === 'decision') return S.decision;
  if (n.type === 'merge') return S.merge;
  if (n.type === 'note') return S.note;
  if (n.lane === 'seller') return S.actionS;
  if (n.lane === 'sys') return S.actionY;
  return S.actionB;
}

function buildUnified() {
  const nodes = [
    // —— Khởi đầu ——
    { id: 's', lane: 'sys', type: 'start', y: 70 },
    {
      id: 'pre',
      lane: 'sys',
      type: 'action',
      text: 'Seller đã ĐỒNG Ý giữ hàng\nstatus = WAITING_PICKUP (2)\nCọc đang hold · hạn phản hồi = pickupTime + 24h',
      y: 110,
      h: 72,
      w: 260,
    },
    {
      id: 'legend',
      lane: 'buyer',
      type: 'note',
      text: 'Chú thích màu:\nXanh dương = Buyer · Xanh lá = Seller\nTím = Hệ thống · Vàng = Quyết định',
      y: 110,
      h: 72,
      w: 240,
    },

    // —— Song song chờ ——
    {
      id: 'waitB',
      lane: 'buyer',
      type: 'action',
      text: 'Mở đơn giữ hàng\nChờ đến nhận · xem giờ lấy',
      y: 220,
      h: 56,
      w: 230,
    },
    {
      id: 'waitS',
      lane: 'seller',
      type: 'action',
      text: 'Chuẩn bị hàng\nSẵn QR gian hàng cố định',
      y: 220,
      h: 56,
      w: 230,
    },

    // —— Seller có thể hủy sau xác nhận (trước khi hoàn tất) ——
    {
      id: 'dCancel',
      lane: 'seller',
      type: 'decision',
      text: 'Seller hủy đơn\nsau xác nhận?',
      y: 310,
      w: 160,
      h: 90,
    },
    {
      id: 'cancelForm',
      lane: 'seller',
      type: 'action',
      text: 'Nhập lý do cụ thể (≥5 ký tự)\n+ ảnh chứng minh (1–5 ảnh)',
      y: 430,
      h: 64,
      w: 240,
    },
    {
      id: 'cancelSys',
      lane: 'sys',
      type: 'action',
      text: '→ REFUNDED (6)\nHoàn cọc Buyer · trả tồn kho\nGửi thông báo cho Buyer\nAdmin xem tab “Shop hủy sau xác nhận”',
      y: 430,
      h: 88,
      w: 270,
    },
    {
      id: 'cancelNotify',
      lane: 'buyer',
      type: 'action',
      text: 'Nhận thông báo hủy\nXem lý do + ảnh · cọc đã về ví',
      y: 430,
      h: 64,
      w: 240,
    },

    // —— Đến giờ nhận? ——
    {
      id: 'dTime',
      lane: 'sys',
      type: 'decision',
      text: 'Đã đến\npickupTime?',
      y: 560,
      w: 150,
      h: 84,
    },

    // ===== TRƯỚC GIỜ: QR =====
    {
      id: 'secQr',
      lane: 'sys',
      type: 'note',
      text: '▼ NHÁNH A — Trước giờ nhận: giao hàng bằng QR',
      y: 670,
      h: 36,
      w: 280,
    },
    {
      id: 'qrB',
      lane: 'buyer',
      type: 'action',
      text: 'Đến shop đúng hẹn\nQuét QR gian hàng trên đơn',
      y: 730,
      h: 56,
      w: 240,
    },
    {
      id: 'qrS',
      lane: 'seller',
      type: 'action',
      text: 'Có mặt tại điểm bán\nĐưa / hiện QR gian hàng cho Buyer',
      y: 730,
      h: 56,
      w: 240,
    },
    {
      id: 'qrOk',
      lane: 'sys',
      type: 'action',
      text: 'QR hợp lệ → COMPLETED (3)\nGiải ngân cọc → Seller · +sold',
      y: 820,
      h: 64,
      w: 250,
    },

    // ===== SAU GIỜ: 2 cột quyết định =====
    {
      id: 'secLate',
      lane: 'sys',
      type: 'note',
      text: '▼ NHÁNH B — Đã tới / quá giờ nhận (trong 24h)',
      y: 940,
      h: 36,
      w: 280,
    },
    {
      id: 'dBuyer',
      lane: 'buyer',
      type: 'decision',
      text: 'Buyer chọn\ntrong 24h?',
      y: 1000,
      w: 150,
      h: 90,
    },
    {
      id: 'dSeller',
      lane: 'seller',
      type: 'decision',
      text: 'Seller tố Buyer\nkhông đến?',
      y: 1000,
      w: 150,
      h: 90,
    },

    // Buyer actions
    {
      id: 'forfeit',
      lane: 'buyer',
      type: 'action',
      text: 'Đồng ý mất cọc\n(forfeit deposit)',
      y: 1140,
      h: 52,
      w: 220,
    },
    {
      id: 'forfeitSys',
      lane: 'sys',
      type: 'action',
      text: '→ COMPLETED (3)\nCọc → Seller · +sold',
      y: 1140,
      h: 52,
      w: 220,
    },
    {
      id: 'repB',
      lane: 'buyer',
      type: 'action',
      text: 'Báo cáo Seller:\nvắng / đóng cửa / không giao / khác\n(+ GPS · mô tả · ảnh 1–5)',
      y: 1230,
      h: 78,
      w: 250,
    },
    {
      id: 'idleB',
      lane: 'buyer',
      type: 'action',
      text: 'Không quét · không báo · không mất cọc\nChờ job hết hạn 24h',
      y: 1340,
      h: 56,
      w: 250,
    },

    // Seller actions
    {
      id: 'repS',
      lane: 'seller',
      type: 'action',
      text: 'Tố Buyer không đến nhận\n(+ GPS · mô tả · ảnh 1–5)\n— không tự complete / không hủy kiểu reject',
      y: 1230,
      h: 78,
      w: 250,
    },
    {
      id: 'idleS',
      lane: 'seller',
      type: 'action',
      text: 'Không tố cáo\nChờ job hết hạn 24h',
      y: 1340,
      h: 52,
      w: 230,
    },

    // Gộp báo cáo
    { id: 'mRep', lane: 'sys', type: 'merge', y: 1450 },
    {
      id: 'toDisp',
      lane: 'sys',
      type: 'action',
      text: 'Có ≥1 báo cáo → DISPUTED (4)\nCọc vẫn hold chờ xử lý',
      y: 1500,
      h: 56,
      w: 250,
    },
    {
      id: 'forfeit2',
      lane: 'buyer',
      type: 'action',
      text: '(Tuỳ chọn) Forfeit khi đang DISPUTED\n→ COMPLETED · cọc Seller',
      y: 1500,
      h: 56,
      w: 250,
    },

    // Deadline
    { id: 'mWait', lane: 'sys', type: 'merge', y: 1610 },
    {
      id: 'dDead',
      lane: 'sys',
      type: 'decision',
      text: 'Job hết hạn\n+24h?\nAi đã báo?',
      y: 1670,
      w: 150,
      h: 100,
    },

    {
      id: 'outNone',
      lane: 'sys',
      type: 'action',
      text: '0 báo cáo\n→ AUTO_COMPLETED (5)\nCọc Seller · +sold',
      y: 1830,
      h: 70,
      w: 230,
    },
    {
      id: 'outB',
      lane: 'sys',
      type: 'action',
      text: 'Chỉ Buyer báo\n→ REFUNDED (6)\nHoàn cọc Buyer',
      y: 1830,
      h: 70,
      w: 210,
    },
    {
      id: 'outS',
      lane: 'sys',
      type: 'action',
      text: 'Chỉ Seller tố\n→ DISPUTE_RESOLVED (7)\nCọc Seller · không +sold',
      y: 1940,
      h: 70,
      w: 240,
    },
    {
      id: 'outBoth',
      lane: 'sys',
      type: 'action',
      text: 'Cả hai báo → Admin quyết\napprove-buyer → (6) hoàn Buyer\napprove-seller → (7) cọc Seller\nreject → giữ DISPUTED',
      y: 1940,
      h: 90,
      w: 260,
    },

    // Kết thúc
    { id: 'mDone', lane: 'sys', type: 'merge', y: 2100 },
    { id: 'e', lane: 'sys', type: 'end', y: 2170 },

    // Ghi chú quyền (cạnh dưới seller)
    {
      id: 'noteRights',
      lane: 'seller',
      type: 'note',
      text: 'Quyền Seller sau accept:\n• Hủy sau xác nhận (lý do+ảnh → hoàn Buyer)\n• Đưa QR khi khách đến\n• Tố Buyer no-show (sau giờ)\nKhông tự bấm “hoàn tất đơn”',
      y: 1830,
      h: 100,
      w: 250,
    },
  ];

  const links = [
    { from: 's', to: 'pre' },
    { from: 'pre', to: 'waitB' },
    { from: 'pre', to: 'waitS' },
    { from: 'waitS', to: 'dCancel' },
    { from: 'waitB', to: 'dTime' },

    // Hủy sau xác nhận
    { from: 'dCancel', to: 'cancelForm', label: 'Có' },
    { from: 'cancelForm', to: 'cancelSys' },
    { from: 'cancelSys', to: 'cancelNotify' },
    { from: 'cancelNotify', to: 'mDone' },
    { from: 'dCancel', to: 'dTime', label: 'Không' },

    // Trước giờ → QR
    { from: 'dTime', to: 'qrB', label: 'Chưa' },
    { from: 'qrB', to: 'qrS' },
    { from: 'qrS', to: 'qrOk' },
    { from: 'qrOk', to: 'mDone' },

    // Sau giờ → 2 quyết định
    { from: 'dTime', to: 'dBuyer', label: 'Rồi / quá giờ' },
    { from: 'dTime', to: 'dSeller', label: 'Rồi / quá giờ' },

    { from: 'dBuyer', to: 'forfeit', label: 'Mất cọc' },
    { from: 'forfeit', to: 'forfeitSys' },
    { from: 'forfeitSys', to: 'mDone' },

    { from: 'dBuyer', to: 'repB', label: 'Báo Seller vắng' },
    { from: 'repB', to: 'mRep' },

    { from: 'dBuyer', to: 'idleB', label: 'Không làm gì' },
    { from: 'idleB', to: 'mWait' },

    { from: 'dSeller', to: 'repS', label: 'Có' },
    { from: 'repS', to: 'mRep' },
    { from: 'dSeller', to: 'idleS', label: 'Không' },
    { from: 'idleS', to: 'mWait' },

    { from: 'mRep', to: 'toDisp' },
    { from: 'toDisp', to: 'mWait' },
    { from: 'toDisp', to: 'forfeit2', label: 'Buyer forfeit' },
    { from: 'forfeit2', to: 'mDone' },

    { from: 'mWait', to: 'dDead' },
    { from: 'dDead', to: 'outNone', label: '0 báo' },
    { from: 'dDead', to: 'outB', label: 'Chỉ Buyer' },
    { from: 'dDead', to: 'outS', label: 'Chỉ Seller' },
    { from: 'dDead', to: 'outBoth', label: 'Cả hai' },

    { from: 'outNone', to: 'mDone' },
    { from: 'outB', to: 'mDone' },
    { from: 'outS', to: 'mDone' },
    { from: 'outBoth', to: 'mDone' },
    { from: 'mDone', to: 'e' },
  ];

  const height = 2280;
  const cells = [];
  cells.push(
    cell(
      't',
      'Activity: Giao nhận hàng & tranh chấp — Người mua | Người bán | Hệ thống',
      40,
      8,
      1080,
      36,
      S.title
    )
  );
  cells.push(cell('L0', 'Người mua (Buyer)', 40, 52, 340, height - 80, S.lane));
  cells.push(cell('L1', 'Người bán (Seller)', 380, 52, 360, height - 80, S.lane));
  cells.push(cell('L2', 'Hệ thống / Job / Admin', 740, 52, 360, height - 80, S.lane));

  // section notes sit in sys lane but are full-width-ish labels — keep as drawn
  nodes.forEach((n) => {
    const cx = CX[n.lane];
    if (n.type === 'start' || n.type === 'end' || n.type === 'merge') {
      const size = n.type === 'merge' ? 32 : 30;
      const label = n.type === 'merge' ? '⊕' : '';
      cells.push(cell(n.id, label, cx - size / 2, n.y, size, size, styleFor(n)));
    } else if (n.type === 'decision') {
      const w = n.w || 150;
      const h = n.h || 84;
      cells.push(cell(n.id, n.text, cx - w / 2, n.y, w, h, styleFor(n)));
    } else {
      const w = n.w || 220;
      const h = n.h || 56;
      cells.push(cell(n.id, n.text, cx - w / 2, n.y, w, h, styleFor(n)));
    }
  });

  links.forEach((l, i) => cells.push(edge(`e${i}`, l.from, l.to, l.label || '')));

  return `  <diagram id="act-delivery-unified" name="Giao nhan hang - Buyer Seller">
    <mxGraphModel dx="1500" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="${height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>`;
}

const xml = `<mxfile host="app.diagrams.net" modified="2026-07-25T08:45:00.000Z" agent="FastMark" version="22.1.0" type="device">
${buildUnified()}
</mxfile>
`;

const outFile = path.join(OUT, '12-Activity-Giao-nhan-hang-Tranh-chap.drawio');
fs.writeFileSync(outFile, xml, 'utf8');
console.log('Wrote', outFile);
