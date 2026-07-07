export function Proximamente({ titulo }: { titulo: string }) {
  return (
    <div className="card superficie">
      <h2 style={{ color: 'var(--color-primario)' }}>{titulo}</h2>
      <p style={{ color: '#555' }}>
        Todavía no está implementado. Es el próximo paso de la secuencia de implementación.
      </p>
    </div>
  );
}
