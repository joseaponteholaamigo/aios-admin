// El enlace a «Tope de la voz» con una cuenta ya puesta en el formulario de la excepción (spec «Editar
// cuentas y personas», CA-2). Aquí y no en un módulo: lo arma la ficha de una cuenta y lo lee la
// pantalla de la voz, y un módulo no importa de otro.

/** El parámetro de la dirección que trae la cuenta. Solo su id: nunca un correo. */
export const VOICE_ACCOUNT_PARAM = 'account';

export const voiceCapHref = (accountId: string) => `/voice?${new URLSearchParams({ [VOICE_ACCOUNT_PARAM]: accountId })}`;
