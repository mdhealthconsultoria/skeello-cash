// Símbolo do Skeello Cash: o esquilo com o dólar, num círculo com anel verde.
// Usado como logo (menu, login) e no mascote animado das telas vazias.

export function MascotSvg({ className = '' }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo-esquilo.png`}
      alt="Skeello Cash"
      draggable={false}
      className={`rounded-full object-cover ${className}`}
    />
  )
}
