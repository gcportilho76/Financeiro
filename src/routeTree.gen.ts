/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols

import { Route as rootRoute } from './routes/__root'
import { Route as IndexImport } from './routes/index'

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

export const routeTree = rootRoute.addChildren([IndexRoute])
