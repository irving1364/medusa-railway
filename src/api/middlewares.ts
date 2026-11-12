import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { CreateProjectSchema, UpdateProjectSchema, ProjectStatusSchema } from "./admin/projects/validators"

export default defineMiddlewares({
  routes: [
    { matcher: "/admin/projects", method: "POST", middlewares: [validateAndTransformBody(CreateProjectSchema)] },
    { matcher: "/admin/projects/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateProjectSchema)] },
    { matcher: "/admin/projects/:id/status", method: "POST", middlewares: [validateAndTransformBody(ProjectStatusSchema)] },
  ],
})
