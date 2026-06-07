import { API_BASES } from './endpoint.constant'

const PROJECT_SUBPATH = 'Project'
export const PROJECT_ENDPOINTS = {
  GETS: `${API_BASES.LOGIC}/${PROJECT_SUBPATH}/Gets`,
  GET: `${API_BASES.LOGIC}/${PROJECT_SUBPATH}/Get`,
  DISABLE: `${API_BASES.LOGIC}/${PROJECT_SUBPATH}/Disable`,
}
