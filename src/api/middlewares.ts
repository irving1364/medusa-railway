import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import multer from "multer"
import { CreateProjectSchema, UpdateProjectSchema, ProjectStatusSchema } from "./admin/projects/validators"
import { CreateMaterialSchema, UpdateMaterialSchema, CreateRedirectSchema } from "./admin/materials/validators"

// Files stay in memory (same approach as the core /admin/uploads route) and are handed to the file module as base64.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 30 } })

export default defineMiddlewares({
  routes: [
    { matcher: "/admin/projects", method: "POST", middlewares: [validateAndTransformBody(CreateProjectSchema)] },
    { matcher: "/admin/projects/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateProjectSchema)] },
    { matcher: "/admin/projects/:id/status", method: "POST", middlewares: [validateAndTransformBody(ProjectStatusSchema)] },
    { matcher: "/admin/materials", method: "POST", middlewares: [validateAndTransformBody(CreateMaterialSchema)] },
    { matcher: "/admin/materials/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateMaterialSchema)] },
    { matcher: "/admin/product-redirects", method: "POST", middlewares: [validateAndTransformBody(CreateRedirectSchema)] },
    { matcher: "/admin/web-uploads", method: "POST", middlewares: [upload.array("files")] },
  ],
})
