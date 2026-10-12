import { ProjectsTable } from "./projects-table"
import { getProjects } from "@/lib/projects"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Projects" }

export default async function ProjectsPage() {
  await requireModule("projects")
  const { projects, clients, projectTypes, projectPhases, error } =
    await getProjects()

  return (
    <ProjectsTable
      projects={projects}
      clients={clients}
      projectTypes={projectTypes}
      projectPhases={projectPhases}
      error={error}
    />
  )
}
