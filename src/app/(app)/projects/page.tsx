import { ProjectsTable } from "./projects-table"
import { getProjects } from "@/lib/projects"

export const metadata = { title: "Projects" }

export default async function ProjectsPage() {
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
