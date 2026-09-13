import { EmptyState, PageHeader } from '../ui/primitives'
import { LinkButton } from '../ui/Button'
import { TruckIcon } from '../ui/icons'

export function NotFoundPage() {
  return (
    <div className="page stack stack-8">
      <PageHeader title="Page not found" subtitle="That address does not match anything in the system." />
      <EmptyState
        icon={<TruckIcon size={20} />}
        title="Nothing here"
        body="The record may have been removed, or the link may be out of date."
        action={<LinkButton to="/fleet" variant="primary">Go to Fleet</LinkButton>}
      />
    </div>
  )
}
