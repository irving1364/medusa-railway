import { Module } from "@medusajs/framework/utils"
import WorkshopModuleService from "./service"

export const WORKSHOP_MODULE = "workshop"

export default Module(WORKSHOP_MODULE, { service: WorkshopModuleService })
