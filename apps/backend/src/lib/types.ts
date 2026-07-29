export type RolUsuario = "ADMIN" | "MEDICO" | "RECEPCION";
export type AccionAudit =
  | "LOGIN_OK"
  | "LOGIN_FAIL"
  | "LOGOUT"
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "BACKUP"
  | "RESTORE"
  | "EXPORT";

export type EstadoCita =
  | "PROGRAMADA"
  | "CONFIRMADA"
  | "EN_CURSO"
  | "ATENDIDA"
  | "CANCELADA"
  | "NO_ASISTIO";

export type TipoCita = "CONSULTA" | "CONTROL" | "EXAMEN" | "PROCEDIMIENTO" | "OTRO";
export type SexoPaciente = "MASCULINO" | "FEMENINO" | "OTRO";