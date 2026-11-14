// Cómo se escriben las fechas y las cantidades en el panel.
//
// EL DEFECTO QUE PREVIENE. Una fecha mal pasada a la hora de Bogotá dice el día equivocado de un
// alta o de una revocación, justo lo que se mira para responder un reclamo. Una cantidad de miles
// sin su punto (`4300`) se lee mal de un vistazo en los números de las cuentas. Y un texto que
// dependa del navegador hace que React vuelva a pintar la página al hidratar.
import { describe, expect, test } from 'vitest';
import { formatCount, formatDate, formatDateTime } from '../app/shared/ui/format';

describe('las fechas', () => {
  test('un instante se escribe en la hora de Bogotá, también cuando cruza el día', () => {
    expect(formatDateTime('2026-11-01T14:30:00Z')).toBe('1 nov 2026, 09:30');
    expect(formatDateTime('2026-11-01T03:00:00.000Z')).toBe('31 oct 2026, 22:00');
    expect(formatDate('2026-11-01T03:00:00.000Z')).toBe('31 oct 2026');
  });

  test('una fecha suelta (el fin de un contrato) no se corre de día', () => {
    expect(formatDate('2026-12-31')).toBe('31 dic 2026');
  });

  test('sin fecha, o con una que no se entiende, un guion', () => {
    expect([formatDate(null), formatDate(''), formatDateTime('no es fecha')]).toEqual(['—', '—', '—']);
  });
});

describe('las cantidades', () => {
  test('llevan punto de miles, y las de menos de mil van como están', () => {
    expect([formatCount(0), formatCount(381), formatCount(4300), formatCount(5012), formatCount(1_000_000)]).toEqual(['0', '381', '4.300', '5.012', '1.000.000']);
  });
});
