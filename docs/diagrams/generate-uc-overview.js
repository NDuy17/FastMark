/**
 * Use Case tổng quát — Buyer / Seller / Admin
 * Run: node docs/diagrams/generate-uc-overview.js
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

function edge(id, source, target) {
  return `<mxCell id="${id}" style="endArrow=none;html=1;rounded=0;strokeColor=#6c8ebf;" edge="1" parent="1" source="${source}" target="${target}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

const S = {
  actor:
    'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=14;',
  uc: 'ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;',
  system:
    'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#666666;dashed=1;verticalAlign=top;fontStyle=1;fontSize=15;spacingTop=8;',
  package:
    'swimlane;fontStyle=1;align=center;verticalAlign=top;startSize=32;horizontal=1;collapsible=0;fillColor=#f5f5f5;strokeColor=#666666;fontSize=13;whiteSpace=wrap;',
  title: 'text;html=1;strokeColor=none;fillColor=none;align=center;fontStyle=1;fontSize=18;',
  note: 'shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;align=left;spacingLeft=6;',
};

const buyer = [
  'Đăng nhập',
  'Tìm kiếm sản phẩm',
  'Xem sản phẩm',
  'Đặt giữ hàng',
  'Chat',
  'Đánh giá',
];

const seller = [
  'Đăng ký người bán',
  'Quản lý gian hàng',
  'Quản lý sản phẩm',
  'Quản lý đơn giữ hàng',
  'Quản lý voucher / khuyến mãi',
  'Xem thống kê',
];

const admin = [
  'Duyệt người bán',
  'Quản lý tài khoản',
  'Quản lý sản phẩm',
  'Quản lý danh mục',
  'Quản lý banner',
  'Quản lý gói bán',
  'Quản lý thông báo',
  'Xem thống kê',
];

const cells = [];
cells.push(cell('title', 'Use Case tổng quát – FastMark', 320, 12, 560, 28, S.title));
cells.push(
  cell('sys', 'Hệ thống FastMark (Mobile App + Admin Web)', 180, 50, 1100, 820, S.system)
);
cells.push(cell('actorB', 'Buyer', 50, 140, 55, 85, S.actor));
cells.push(cell('actorS', 'Seller', 50, 380, 55, 85, S.actor));
cells.push(cell('actorA', 'Admin', 50, 620, 55, 85, S.actor));

function place(prefix, title, cases, x, y, actorId) {
  const ucW = 260;
  const ucH = 44;
  const gap = 8;
  const pkgH = 36 + cases.length * (ucH + gap) + 6;
  cells.push(cell(`${prefix}_pkg`, title, x, y, ucW + 36, pkgH, S.package));
  cases.forEach((name, i) => {
    const uid = `${prefix}_uc${i}`;
    cells.push(cell(uid, name, x + 18, y + 36 + i * (ucH + gap), ucW, ucH, S.uc));
    cells.push(edge(`${prefix}_e${i}`, actorId, uid));
  });
}

place('b', 'Buyer', buyer, 220, 70, 'actorB');
place('s', 'Seller', seller, 560, 70, 'actorS');
place('a', 'Admin', admin, 900, 70, 'actorA');

cells.push(
  cell(
    'note1',
    'Ghi chú FastMark:\n• Voucher = Khuyến mãi % giảm giá sản phẩm\n• Chi tiết: 00-UC-Checklist-Day-du.drawio',
    220,
    720,
    340,
    90,
    S.note
  )
);

const xml = `<mxfile host="app.diagrams.net" modified="2026-07-24T03:30:00.000Z" agent="FastMark" version="22.1.0" type="device">
  <diagram id="uc-overview-simple" name="Use Case tổng quát">
    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1400" pageHeight="900" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

fs.writeFileSync(path.join(OUT, '01-UC-Tong-quan.drawio'), xml, 'utf8');
console.log('Wrote 01-UC-Tong-quan.drawio');
