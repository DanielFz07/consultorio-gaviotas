/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      username: string;
      nombre: string;
      rol: "ADMIN" | "MEDICO" | "RECEPCION";
    };
  }
}