import { useCan } from '../context/AuthContext'

export default function Can({ permission, children, fallback = null }) {
  return useCan(permission) ? children : fallback
}
