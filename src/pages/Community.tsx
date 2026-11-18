import { Navigate } from 'react-router-dom'

/** A busca de amigos agora fica em Pessoas > Solicitações e amigos. */
export default function Community() {
  return <Navigate to="/pessoas" replace state={{ tab: 'requests' }} />
}
