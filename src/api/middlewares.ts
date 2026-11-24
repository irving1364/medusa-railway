import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import multer from "multer"
import { CreateProjectSchema, UpdateProjectSchema, ProjectStatusSchema } from "./admin/projects/validators"
import { CreateMaterialSchema, UpdateMaterialSchema, CreateRedirectSchema } from "./admin/materials/validators"
import { CreateQuoteSchema, UpdateQuoteSchema, QuoteStatusSchema, SendQuoteSchema, ProfileSchema } from "./admin/quotes/validators"
import { UpdateCompanySchema } from "./admin/companies/validators"
import { z } from "zod"

const QuoteResponseSchema = z.object({ action: z.enum(["accept", "changes", "reject"]), name: z.string().trim().min(2).max(120), comment: z.string().max(2000).nullable().optional() })
import { CreateMailAccountSchema, UpdateMailAccountSchema, TestMailAccountSchema, OutgoingSchema, FlagsSchema, MoveSchema } from "./admin/mail/validators"
import { CreateWorkOrderSchema, UpdateWorkOrderSchema, WorkStageSchema, CreateActivitySchema, UpdateActivitySchema, ResourceSchema, UpdateResourceSchema, CreateMaterialLineSchema, UpdateMaterialLineSchema, ConsumeSchema } from "./admin/workshop/validators"
import { SupplierSchema, UpdateSupplierSchema, ItemSchema, UpdateItemSchema, CreatePurchaseOrderSchema, UpdatePurchaseOrderSchema, PurchaseStatusSchema, SendPurchaseSchema, ReceiptSchema, PaymentSchema, PurchaseProfileSchema, StockAdjustSchema } from "./admin/purchases/validators"

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
    { matcher: "/admin/quotes", method: "POST", middlewares: [validateAndTransformBody(CreateQuoteSchema)] },
    { matcher: "/admin/quotes/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateQuoteSchema)] },
    { matcher: "/admin/quotes/:id/status", method: "POST", middlewares: [validateAndTransformBody(QuoteStatusSchema)] },
    { matcher: "/admin/quotes/:id/send", method: "POST", middlewares: [validateAndTransformBody(SendQuoteSchema)] },
    { matcher: "/admin/quote-profiles/:store", method: "POST", middlewares: [validateAndTransformBody(ProfileSchema)] },
    { matcher: "/store/quotes/:token/respond", method: "POST", middlewares: [validateAndTransformBody(QuoteResponseSchema)] },
    { matcher: "/admin/companies/:code", method: "POST", middlewares: [validateAndTransformBody(UpdateCompanySchema)] },
    { matcher: "/admin/suppliers", method: "POST", middlewares: [validateAndTransformBody(SupplierSchema)] },
    { matcher: "/admin/suppliers/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateSupplierSchema)] },
    { matcher: "/admin/purchase-items", method: "POST", middlewares: [validateAndTransformBody(ItemSchema)] },
    { matcher: "/admin/purchase-items/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateItemSchema)] },
    { matcher: "/admin/purchase-orders", method: "POST", middlewares: [validateAndTransformBody(CreatePurchaseOrderSchema)] },
    { matcher: "/admin/purchase-orders/:id", method: "POST", middlewares: [validateAndTransformBody(UpdatePurchaseOrderSchema)] },
    { matcher: "/admin/purchase-orders/:id/status", method: "POST", middlewares: [validateAndTransformBody(PurchaseStatusSchema)] },
    { matcher: "/admin/purchase-orders/:id/send", method: "POST", middlewares: [validateAndTransformBody(SendPurchaseSchema)] },
    { matcher: "/admin/purchase-orders/:id/receipts", method: "POST", middlewares: [validateAndTransformBody(ReceiptSchema)] },
    { matcher: "/admin/purchase-orders/:id/payments", method: "POST", middlewares: [validateAndTransformBody(PaymentSchema)] },
    { matcher: "/admin/purchase-profiles/:company", method: "POST", middlewares: [validateAndTransformBody(PurchaseProfileSchema)] },
    // Correo (IMAP/SMTP). Sending carries attachments as base64, hence the larger body limit.
    { matcher: "/admin/mail/accounts", method: "POST", middlewares: [validateAndTransformBody(CreateMailAccountSchema)] },
    { matcher: "/admin/mail/accounts/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateMailAccountSchema)] },
    { matcher: "/admin/mail/verify", method: "POST", middlewares: [validateAndTransformBody(TestMailAccountSchema)] },
    { matcher: "/admin/mail/accounts/:id/send", method: "POST", bodyParser: { sizeLimit: "35mb" }, middlewares: [validateAndTransformBody(OutgoingSchema)] },
    { matcher: "/admin/mail/accounts/:id/drafts", method: "POST", bodyParser: { sizeLimit: "35mb" }, middlewares: [validateAndTransformBody(OutgoingSchema)] },
    { matcher: "/admin/mail/accounts/:id/messages/:uid/flags", method: "POST", middlewares: [validateAndTransformBody(FlagsSchema)] },
    { matcher: "/admin/mail/accounts/:id/messages/:uid/move", method: "POST", middlewares: [validateAndTransformBody(MoveSchema)] },
    // Taller
    { matcher: "/admin/workshop/orders", method: "POST", middlewares: [validateAndTransformBody(CreateWorkOrderSchema)] },
    { matcher: "/admin/workshop/orders/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateWorkOrderSchema)] },
    { matcher: "/admin/workshop/orders/:id/stage", method: "POST", middlewares: [validateAndTransformBody(WorkStageSchema)] },
    { matcher: "/admin/workshop/orders/:id/activities", method: "POST", middlewares: [validateAndTransformBody(CreateActivitySchema)] },
    { matcher: "/admin/workshop/activities/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateActivitySchema)] },
    { matcher: "/admin/workshop/resources", method: "POST", middlewares: [validateAndTransformBody(ResourceSchema)] },
    { matcher: "/admin/workshop/resources/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateResourceSchema)] },
    { matcher: "/admin/workshop/orders/:id/materials", method: "POST", middlewares: [validateAndTransformBody(CreateMaterialLineSchema)] },
    { matcher: "/admin/workshop/materials/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateMaterialLineSchema)] },
    { matcher: "/admin/workshop/materials/:id/consume", method: "POST", middlewares: [validateAndTransformBody(ConsumeSchema)] },
    { matcher: "/admin/purchase-items/:id/stock", method: "POST", middlewares: [validateAndTransformBody(StockAdjustSchema)] },
  ],
})
