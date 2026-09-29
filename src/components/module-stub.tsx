export function ModuleStub({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This module is not built yet.
      </p>
    </div>
  )
}
