import { Link } from 'react-router-dom';

export default function ComingSoonPage({ title, description, backTo = '/' }) {
  return (
    <div className="admin-page">
      <section className="admin-panel coming-soon-page">
        <div>
          <span className="coming-soon-badge">Sắp ra mắt</span>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
          <p style={{ marginTop: 20 }}>
            <Link className="btn-primary" to={backTo} style={{ display: 'inline-block', textDecoration: 'none' }}>
              Quay lại
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
