import { getTableRowStt } from '../../utils/tableRowNumber';

export function TableSttHeader() {
  return <th className="col-stt">STT</th>;
}

export function TableSttCell({ page = 1, limit = 10, index = 0 }) {
  return <td className="col-stt stt-cell">{getTableRowStt(page, limit, index)}</td>;
}
