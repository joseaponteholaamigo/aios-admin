// Una lista de datos de etiqueta y valor (`Plan: Team`), para las fichas de empresas y personas.
import type { ReactNode } from 'react';
import './fact-list.css';

export type Fact = { label: string; value: ReactNode };

export function FactList({ facts }: { facts: Fact[] }) {
  return (
    <dl className="facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
