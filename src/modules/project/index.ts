import { Module } from "@medusajs/framework/utils"
import ProjectModuleService from "./service"

export const PROJECT_MODULE = "project"

export default Module(PROJECT_MODULE, { service: ProjectModuleService })
