import { createFileRoute } from '@tanstack/react-router'
// Importe aqui o seu componente principal (ex: Dashboard)
import { Dashboard } from '@/components/Dashboard' 

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return <Dashboard />
}
