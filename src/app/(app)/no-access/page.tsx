export const metadata = { title: "No Access" }

export default function NoAccessPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-medium tracking-tight">No Access</h1>
      <p className="text-sm text-muted-foreground">
        Your account does not have permission to view a module. Ask an owner to update your access.
      </p>
    </div>
  )
}
