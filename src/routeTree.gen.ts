/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
import { createFileRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'

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

export const routeTree = rootRoute._addFileChildren([])
