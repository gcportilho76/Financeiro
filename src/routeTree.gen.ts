/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols

import { createFileRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'
import { Route as IndexImport } from './routes/index'

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
  }
}

export const routeTree = rootRoute._addChildren([IndexRoute])
