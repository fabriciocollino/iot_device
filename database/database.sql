-- Version 1.0

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE "configuracion" (
    "parametro" TEXT NOT NULL CONSTRAINT constraint_name PRIMARY KEY,
    "detalle" TEXT NOT NULL,
    "valor" TEXT NOT NULL
);

CREATE TABLE "personas" (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "hor_tipo" INTEGER,
    "hor_id" INTEGER,
    "legajo" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "dni" TEXT NOT NULL,
    "tag" TEXT,
    "enable" INTEGER NOT null,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "logs_equipo" (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "lector" INTEGER NOT NULL,
    "fecha_hora" INTEGER NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "accion" INTEGER NOT NULL,
    "extra" INTEGER NOT NULL,
    "dedo" INTEGER NOT NULL,
      FOREIGN KEY(persona_id) REFERENCES personas(id)
);

CREATE TABLE huella (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "persona_id" INTEGER NOT NULL,
    "dedo" INTEGER NOT NULL,
    "datos" BLOB NOT NULL,
    "enabled" INTEGER NOT NULL,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE horario_normal (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "detalle" TEXT NOT NULL,
    "inicio_lun" TEXT,
    "fin_lun" TEXT,
    "inicio_mar" TEXT,
    "fin_mar" TEXT,
    "inicio_mie" TEXT,
    "fin_mie" TEXT,
    "inicio_jue" TEXT,
    "fin_jue" TEXT,
    "inicio_vie" TEXT,
    "fin_vie" TEXT,
    "inicio_sab" TEXT,
    "fin_sab" TEXT,
    "inicio_dom" TEXT,
    "fin_dom" TEXT,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE horario_flexible (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "detalle" TEXT NOT NULL,
    "horarios" TEXT,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE horario_rotativos (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "detalle" TEXT NOT NULL,
    "horarios" TEXT,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companias (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "nombre" TEXT NOT NULL,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grupos (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "detalle" TEXT NOT NULL,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grupos_personas (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "grupo_id" INTEGER NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feriados (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "grupo_id" INTEGER NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "tipo" INTEGER NOT NULL,
    "fecha_inicio" INTEGER NOT NULL,
    "fecha_fin" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE licensias (
    "id" INTEGER PRIMARY KEY  NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "tipo" INTEGER NOT NULL,
    "fecha_inicio" INTEGER NOT NULL,
    "fecha_fin" INTEGER NOT NULL,
    "duracion" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL,
    "eliminado" INTEGER DEFAULT 0,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE fechas_mod (
    "tabla" TEXT NOT NULL,
    "fecha_mod" INTEGER DEFAULT CURRENT_TIMESTAMP
);

INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('persons', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('fingerprints', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('normal_hours', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('flex_hours', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('fingerprints', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('rotative_hours', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('companies', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('groups', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('groups_persons', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('holydays', 0);
INSERT OR replace INTO fechas_mod (tabla, fecha_mod) VALUES ('licenses', 0);

COMMIT;
