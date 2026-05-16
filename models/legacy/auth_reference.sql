-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.auditoria_general (
  iid_auditoria bigint NOT NULL DEFAULT nextval('auditoria_general_iid_auditoria_seq'::regclass),
  vnombre_tabla character varying NOT NULL,
  iid_registro bigint NOT NULL,
  coperacion character NOT NULL CHECK (coperacion = ANY (ARRAY['I'::bpchar, 'U'::bpchar, 'D'::bpchar])),
  jsonb_datos_anteriores jsonb,
  jsonb_datos_nuevos jsonb,
  iid_usuario integer NOT NULL,
  dfecha_operacion timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vip_origen character varying,
  vagente_usuario text,
  vobservaciones text,
  CONSTRAINT auditoria_general_pkey PRIMARY KEY (iid_auditoria),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (iid_usuario) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.bancos (
  iidbanco integer NOT NULL DEFAULT nextval('bancos_iidbanco_seq'::regclass),
  vnombrebanco character varying NOT NULL UNIQUE,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT bancos_pkey PRIMARY KEY (iidbanco)
);
CREATE TABLE public.bodegaresponsable (
  idbodega integer NOT NULL,
  iidusuario integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bodegaresponsable_pkey PRIMARY KEY (idbodega),
  CONSTRAINT fk_bodegaresponsable_bodega FOREIGN KEY (idbodega) REFERENCES public.tbl_bodegas(iid_bodega),
  CONSTRAINT fk_bodega_usuario FOREIGN KEY (iidusuario) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.clase_activos (
  iid_clase_activo integer NOT NULL DEFAULT nextval('clase_activos_iid_clase_activo_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT clase_activos_pkey PRIMARY KEY (iid_clase_activo)
);
CREATE TABLE public.estado_activos (
  iid_estado_activo integer NOT NULL DEFAULT nextval('estado_activos_iid_estado_activo_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT estado_activos_pkey PRIMARY KEY (iid_estado_activo)
);
CREATE TABLE public.familia_activos (
  iid_familia_activo integer NOT NULL DEFAULT nextval('familia_activos_iid_familia_activo_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT familia_activos_pkey PRIMARY KEY (iid_familia_activo)
);
CREATE TABLE public.formas_pago (
  iidformapago integer NOT NULL DEFAULT nextval('formas_pago_iidformapago_seq'::regclass),
  vnombreformapago character varying NOT NULL UNIQUE,
  vrequierereferencia boolean DEFAULT false,
  bactivo boolean NOT NULL DEFAULT true,
  v_codigo_sri character varying,
  b_usar_borrador boolean DEFAULT false,
  b_pendiente_confirmacion boolean DEFAULT false,
  CONSTRAINT formas_pago_pkey PRIMARY KEY (iidformapago)
);
CREATE TABLE public.knex_migrations (
  id integer NOT NULL DEFAULT nextval('knex_migrations_id_seq'::regclass),
  name character varying,
  batch integer,
  migration_time timestamp with time zone,
  CONSTRAINT knex_migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.knex_migrations_lock (
  index integer NOT NULL DEFAULT nextval('knex_migrations_lock_index_seq'::regclass),
  is_locked integer,
  CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index)
);
CREATE TABLE public.marca_activos (
  iid_marca_activo integer NOT NULL DEFAULT nextval('marca_activos_iid_marca_activo_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT marca_activos_pkey PRIMARY KEY (iid_marca_activo)
);
CREATE TABLE public.modelo_activos (
  iid_modelo_activo integer NOT NULL DEFAULT nextval('modelo_activos_iid_marca_activo_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT modelo_activos_pkey PRIMARY KEY (iid_modelo_activo)
);
CREATE TABLE public.monedas (
  iidmoneda integer NOT NULL DEFAULT nextval('monedas_iidmoneda_seq'::regclass),
  vnombremoneda character varying NOT NULL UNIQUE,
  vsimbolo character varying,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT monedas_pkey PRIMARY KEY (iidmoneda)
);
CREATE TABLE public.nombre_activos (
  iid_nombre_activo integer NOT NULL DEFAULT nextval('nombre_activos_iid_nombre_activo_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT nombre_activos_pkey PRIMARY KEY (iid_nombre_activo)
);
CREATE TABLE public.odontbl_imagenes_paciente (
  iid_imagen integer NOT NULL DEFAULT nextval('odontbl_imagenes_paciente_iid_imagen_seq'::regclass),
  iidpaciente bigint NOT NULL,
  vurl_imagen text NOT NULL,
  vtipo_imagen character varying,
  vdescripcion text,
  dfecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  bactivo boolean DEFAULT true,
  CONSTRAINT odontbl_imagenes_paciente_pkey PRIMARY KEY (iid_imagen),
  CONSTRAINT odontbl_imagenes_paciente_iidpaciente_foreign FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente)
);
CREATE TABLE public.odontbl_movimientos_saldo (
  iid_movimiento integer NOT NULL DEFAULT nextval('odontbl_movimientos_saldo_iid_movimiento_seq'::regclass),
  iidpaciente bigint NOT NULL,
  dmonto numeric NOT NULL,
  vtipo_movimiento character varying NOT NULL CHECK (vtipo_movimiento::text = ANY (ARRAY['ANTICIPO'::character varying, 'ANTICIPO_PENDIENTE'::character varying, 'CONSUMO_FACTURA'::character varying, 'EXCEDENTE_PAGO'::character varying, 'DEVOLUCION_EFECTIVO'::character varying, 'AJUSTE_AUDITORIA'::character varying]::text[])),
  iidfactura integer,
  dfecha_movimiento timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  iidformapago integer,
  vobservaciones text,
  iidusuariocrea integer,
  CONSTRAINT odontbl_movimientos_saldo_pkey PRIMARY KEY (iid_movimiento),
  CONSTRAINT fk_mov_paciente FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT fk_mov_factura FOREIGN KEY (iidfactura) REFERENCES public.odontblfacturas_venta(iidfactura),
  CONSTRAINT odontbl_movimientos_saldo_iidformapago_fkey FOREIGN KEY (iidformapago) REFERENCES public.formas_pago(iidformapago),
  CONSTRAINT odontbl_movimientos_saldo_iidusuariocrea_fkey FOREIGN KEY (iidusuariocrea) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.odontblcategorias (
  iidcategoria integer NOT NULL DEFAULT nextval('odontblcategorias_iidcategoria_seq'::regclass),
  vcodigo character varying NOT NULL UNIQUE,
  vnombre character varying NOT NULL,
  bestado boolean DEFAULT true,
  CONSTRAINT odontblcategorias_pkey PRIMARY KEY (iidcategoria)
);
CREATE TABLE public.odontblcitamedica (
  iidcita integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iidpaciente bigint NOT NULL,
  iiddoctor integer NOT NULL,
  iidconsultorio integer NOT NULL,
  iidespecialidad integer NOT NULL,
  dfechacita timestamp without time zone NOT NULL,
  choracita character NOT NULL,
  itiempo smallint NOT NULL,
  iidestadocita integer NOT NULL DEFAULT 1,
  CONSTRAINT odontblcitamedica_pkey PRIMARY KEY (iidcita),
  CONSTRAINT fk_cita_paciente FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT fk_cita_doctor FOREIGN KEY (iiddoctor) REFERENCES public.odontbldoctores(iiddoctor),
  CONSTRAINT fk_cita_consultorio FOREIGN KEY (iidconsultorio) REFERENCES public.tblconsultorios(iidconsultorio),
  CONSTRAINT fk_cita_especialidad FOREIGN KEY (iidespecialidad) REFERENCES public.tblespecialidades(iidespecialidad),
  CONSTRAINT fk_cita_estado FOREIGN KEY (iidestadocita) REFERENCES public.tblestadocitas(iidestadocita)
);
CREATE TABLE public.odontbldescuentos (
  iiddescuento integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  dfechadescuento timestamp without time zone NOT NULL DEFAULT now(),
  iidpaciente bigint NOT NULL,
  dcvalordescuento numeric NOT NULL,
  dcvalorfinal numeric NOT NULL,
  iidusuariocrea integer NOT NULL,
  iidusuarioautoriza integer,
  bactivo boolean NOT NULL DEFAULT true,
  ctipodescuento character NOT NULL DEFAULT 'M'::bpchar CHECK (ctipodescuento = ANY (ARRAY['P'::bpchar, 'M'::bpchar])),
  nporcentaje numeric DEFAULT 0 CHECK (nporcentaje >= 0::numeric AND nporcentaje <= 100::numeric),
  iiddetallefactura integer,
  vmotivo_eliminacion text,
  CONSTRAINT odontbldescuentos_pkey PRIMARY KEY (iiddescuento),
  CONSTRAINT fk_descuento_paciente FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT fk_descuento_usuariocrea FOREIGN KEY (iidusuariocrea) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_descuento_usuarioautoriza FOREIGN KEY (iidusuarioautoriza) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_descuento_detalle FOREIGN KEY (iiddetallefactura) REFERENCES public.odontbldetalle_factura_venta(iiddetallefactura)
);
CREATE TABLE public.odontbldetalle_factura_venta (
  iiddetallefactura integer NOT NULL DEFAULT nextval('odontbldetalle_factura_venta_iiddetallefactura_seq'::regclass),
  iidfactura integer NOT NULL,
  iidprocedimiento integer NOT NULL,
  vdescripcion character varying NOT NULL,
  icantidad integer NOT NULL DEFAULT 1,
  dpreciounitario numeric NOT NULL,
  iiddescuento integer,
  dsubtotal numeric NOT NULL,
  dporcentajeiva numeric DEFAULT 0,
  dvaloriba numeric DEFAULT 0,
  dtotal numeric NOT NULL,
  bactivo boolean DEFAULT true,
  dvalordescuento numeric NOT NULL DEFAULT 0,
  CONSTRAINT odontbldetalle_factura_venta_pkey PRIMARY KEY (iiddetallefactura),
  CONSTRAINT odontbldetalle_factura_venta_iidfactura_fkey FOREIGN KEY (iidfactura) REFERENCES public.odontblfacturas_venta(iidfactura),
  CONSTRAINT odontbldetalle_factura_venta_iidprocedimiento_fkey FOREIGN KEY (iidprocedimiento) REFERENCES public.odontblprocedimientospaciente(iidprocedimiento),
  CONSTRAINT odontbldetalle_factura_venta_iiddescuento_fkey FOREIGN KEY (iiddescuento) REFERENCES public.odontbldescuentos(iiddescuento)
);
CREATE TABLE public.odontbldetalle_notas_credito (
  iiddetallenotacredito integer NOT NULL DEFAULT nextval('odontbldetalle_notas_credito_iiddetallenotacredito_seq'::regclass),
  iidnotacredito integer,
  vdescripcion character varying,
  icantidad integer,
  dpreciounitario numeric,
  dvalordescuento numeric,
  dsubtotal numeric,
  dporcentajeiva numeric,
  dvaloriva numeric,
  dtotal numeric,
  bactivo boolean DEFAULT true,
  CONSTRAINT odontbldetalle_notas_credito_pkey PRIMARY KEY (iiddetallenotacredito),
  CONSTRAINT odontbldetalle_notas_credito_iidnotacredito_fkey FOREIGN KEY (iidnotacredito) REFERENCES public.odontblnotas_credito(iidnotacredito)
);
CREATE TABLE public.odontbldoctores (
  iiddoctor integer NOT NULL,
  iidcargo integer NOT NULL,
  iidespecialidad integer,
  dfechacontratacion date,
  btemporal boolean NOT NULL DEFAULT false,
  iidpersona integer NOT NULL UNIQUE,
  CONSTRAINT odontbldoctores_pkey PRIMARY KEY (iiddoctor),
  CONSTRAINT fk_doctor_persona FOREIGN KEY (iidpersona) REFERENCES public.personas(iidpersona),
  CONSTRAINT fk_doctor_cargo FOREIGN KEY (iidcargo) REFERENCES public.tblcargos(iidcargo),
  CONSTRAINT fk_doctor_especialidad FOREIGN KEY (iidespecialidad) REFERENCES public.tblespecialidades(iidespecialidad)
);
CREATE TABLE public.odontblfacturas_pagos (
  iidfacturapago integer NOT NULL DEFAULT nextval('odontblfacturas_pagos_iidfacturapago_seq'::regclass),
  iidfactura integer NOT NULL,
  iidformapago integer NOT NULL,
  dmontopago numeric NOT NULL,
  dfecha timestamp without time zone DEFAULT now(),
  vreferencia character varying,
  bactivo boolean DEFAULT true,
  vobservaciones text,
  b_confirmado boolean DEFAULT true,
  iid_usuario_confirma integer,
  dfecha_confirmacion timestamp without time zone,
  vcomprobante_ruta character varying,
  CONSTRAINT odontblfacturas_pagos_pkey PRIMARY KEY (iidfacturapago),
  CONSTRAINT fk_pagos_factura FOREIGN KEY (iidfactura) REFERENCES public.odontblfacturas_venta(iidfactura),
  CONSTRAINT fk_pagos_formapago FOREIGN KEY (iidformapago) REFERENCES public.formas_pago(iidformapago),
  CONSTRAINT odontblfacturas_pagos_iid_usuario_confirma_fkey FOREIGN KEY (iid_usuario_confirma) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.odontblfacturas_venta (
  iidfactura integer NOT NULL DEFAULT nextval('odontblfacturas_venta_iidfactura_seq'::regclass),
  iid_entidad_facturadora integer NOT NULL,
  iidpaciente integer NOT NULL,
  vnumerofactura character varying NOT NULL,
  vclaveacceso character varying,
  vnumeroautorizacion character varying,
  dfechaemision timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dfechaautorizacion timestamp without time zone,
  dsubtotal0 numeric NOT NULL DEFAULT 0,
  dsubtotalconiva numeric NOT NULL DEFAULT 0,
  dsubtotal numeric NOT NULL DEFAULT 0,
  ddescuento numeric NOT NULL DEFAULT 0,
  dbaseimponible numeric NOT NULL DEFAULT 0,
  diva numeric NOT NULL DEFAULT 0,
  dtotal numeric NOT NULL DEFAULT 0,
  vestado character varying DEFAULT 'EMITIDA'::character varying,
  vestadosri character varying,
  vobservaciones text,
  iidusuariocrea integer,
  iidusuarioanula integer,
  dfechaanulacion timestamp without time zone,
  vmotivoanulacion text,
  bactivo boolean DEFAULT true,
  dcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  dmodificado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  vpathxml text,
  vpathpdf text,
  nporcentajeiva numeric DEFAULT 0,
  bocultar_descuento boolean DEFAULT false,
  bocultar_tratamientos boolean DEFAULT false,
  CONSTRAINT odontblfacturas_venta_pkey PRIMARY KEY (iidfactura),
  CONSTRAINT odontblfacturas_venta_iid_entidad_facturadora_fkey FOREIGN KEY (iid_entidad_facturadora) REFERENCES public.tbl_entidades_facturadoras(iid_entidad_facturadora),
  CONSTRAINT odontblfacturas_venta_iidpaciente_fkey FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT odontblfacturas_venta_iidusuariocrea_fkey FOREIGN KEY (iidusuariocrea) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT odontblfacturas_venta_iidusuarioanula_fkey FOREIGN KEY (iidusuarioanula) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.odontblmotivos_notas_debito (
  iidmotivonotadebito integer NOT NULL DEFAULT nextval('odontblmotivos_notas_debito_iidmotivonotadebito_seq'::regclass),
  iidnotadebito integer,
  vrazon character varying,
  dvalor numeric,
  bactivo boolean DEFAULT true,
  CONSTRAINT odontblmotivos_notas_debito_pkey PRIMARY KEY (iidmotivonotadebito),
  CONSTRAINT odontblmotivos_notas_debito_iidnotadebito_fkey FOREIGN KEY (iidnotadebito) REFERENCES public.odontblnotas_debito(iidnotadebito)
);
CREATE TABLE public.odontblnotas_credito (
  iidnotacredito integer NOT NULL DEFAULT nextval('odontblnotas_credito_iidnotacredito_seq'::regclass),
  iid_entidad_facturadora integer,
  iidfacturamodificada integer,
  iidpaciente integer,
  vnumeronotacredito character varying,
  vclaveacceso character varying,
  vnumeroautorizacion character varying,
  dfechaemision timestamp without time zone,
  dfechaautorizacion timestamp without time zone,
  dsubtotal0 numeric NOT NULL DEFAULT 0,
  dsubtotalconiva numeric NOT NULL DEFAULT 0,
  dsubtotal numeric NOT NULL DEFAULT 0,
  diva numeric NOT NULL DEFAULT 0,
  nporcentajeiva numeric NOT NULL DEFAULT 0,
  dtotal numeric NOT NULL DEFAULT 0,
  vmotivo character varying,
  vestado character varying,
  vestadosri character varying,
  iidusuariocrea integer,
  vpathxml character varying,
  vpathpdf character varying,
  bactivo boolean DEFAULT true,
  dcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  dmodificado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT odontblnotas_credito_pkey PRIMARY KEY (iidnotacredito),
  CONSTRAINT odontblnotas_credito_iid_entidad_facturadora_fkey FOREIGN KEY (iid_entidad_facturadora) REFERENCES public.tbl_entidades_facturadoras(iid_entidad_facturadora),
  CONSTRAINT odontblnotas_credito_iidpaciente_fkey FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT odontblnotas_credito_iidusuariocrea_fkey FOREIGN KEY (iidusuariocrea) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.odontblnotas_debito (
  iidnotadebito integer NOT NULL DEFAULT nextval('odontblnotas_debito_iidnotadebito_seq'::regclass),
  iid_entidad_facturadora integer,
  iidfacturamodificada integer,
  iidpaciente integer,
  vnumeronotadebito character varying,
  vclaveacceso character varying,
  vnumeroautorizacion character varying,
  dfechaemision timestamp without time zone,
  dfechaautorizacion timestamp without time zone,
  dsubtotal numeric NOT NULL DEFAULT 0,
  diva numeric NOT NULL DEFAULT 0,
  dtotal numeric NOT NULL DEFAULT 0,
  vestado character varying,
  vestadosri character varying,
  iidusuariocrea integer,
  vpathxml character varying,
  vpathpdf character varying,
  bactivo boolean DEFAULT true,
  dcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  dmodificado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT odontblnotas_debito_pkey PRIMARY KEY (iidnotadebito),
  CONSTRAINT odontblnotas_debito_iid_entidad_facturadora_fkey FOREIGN KEY (iid_entidad_facturadora) REFERENCES public.tbl_entidades_facturadoras(iid_entidad_facturadora),
  CONSTRAINT odontblnotas_debito_iidpaciente_fkey FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT odontblnotas_debito_iidusuariocrea_fkey FOREIGN KEY (iidusuariocrea) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.odontblpacientes (
  iidpaciente bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  vcedula character varying,
  vprimerapellido character varying NOT NULL,
  vsegundoapellido character varying,
  votrosapellidos character varying,
  vnombres character varying NOT NULL,
  dfechanacimiento date,
  csexo character CHECK (csexo = ANY (ARRAY['M'::bpchar, 'F'::bpchar, 'O'::bpchar])),
  iedad smallint CHECK (iedad >= 0 AND iedad <= 150),
  vdireccion character varying,
  iidciudad integer,
  iidpais integer,
  vtelefonocasa character varying,
  vtelefonotrabajo character varying,
  vcelular character varying,
  vfax character varying,
  vemail character varying,
  vestadocivil character varying,
  vocupacion character varying,
  vlugartrabajo character varying,
  vdirecciontrabajo character varying,
  iidciudadtrabajo integer,
  iidnacionalidad integer,
  vrecomendadopor character varying,
  vrutafoto character varying,
  cestado boolean NOT NULL DEFAULT true,
  iidpaciente_responsable bigint,
  CONSTRAINT odontblpacientes_pkey PRIMARY KEY (iidpaciente),
  CONSTRAINT fk_paciente_responsable FOREIGN KEY (iidpaciente_responsable) REFERENCES public.odontblpacientes(iidpaciente)
);
CREATE TABLE public.odontblpagos_notas_debito (
  iidpagonotadebito integer NOT NULL DEFAULT nextval('odontblpagos_notas_debito_iidpagonotadebito_seq'::regclass),
  iidnotadebito integer,
  iidformapago integer,
  dmontopago numeric,
  bactivo boolean DEFAULT true,
  dfecha timestamp without time zone DEFAULT now(),
  CONSTRAINT odontblpagos_notas_debito_pkey PRIMARY KEY (iidpagonotadebito),
  CONSTRAINT odontblpagos_notas_debito_iidnotadebito_fkey FOREIGN KEY (iidnotadebito) REFERENCES public.odontblnotas_debito(iidnotadebito),
  CONSTRAINT odontblpagos_notas_debito_iidformapago_fkey FOREIGN KEY (iidformapago) REFERENCES public.formas_pago(iidformapago)
);
CREATE TABLE public.odontblpiezasdentales (
  iidpieza integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  imagen_url text,
  CONSTRAINT odontblpiezasdentales_pkey PRIMARY KEY (iidpieza)
);
CREATE TABLE public.odontblprocedimientopiezasdetalle (
  iidprocedimientopiezadetalle integer NOT NULL DEFAULT nextval('odontblprocedimientopiezasdeta_iidprocedimientopiezadetalle_seq'::regclass),
  iidprocedimiento integer NOT NULL,
  iidpieza integer NOT NULL,
  vseccion character varying,
  vcolor character varying,
  vestado character varying,
  vdescripcion text,
  dfechacreacion timestamp without time zone DEFAULT now(),
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT odontblprocedimientopiezasdetalle_pkey PRIMARY KEY (iidprocedimientopiezadetalle),
  CONSTRAINT fk_procpiezadet_procedimiento FOREIGN KEY (iidprocedimiento) REFERENCES public.odontblprocedimientospaciente(iidprocedimiento),
  CONSTRAINT fk_procpiezadet_pieza FOREIGN KEY (iidpieza) REFERENCES public.odontblpiezasdentales(iidpieza)
);
CREATE TABLE public.odontblprocedimientospaciente (
  iidprocedimiento integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iidpaciente bigint NOT NULL,
  iidtratamientodetalle integer,
  iiddoctor integer NOT NULL,
  iidconsultorio integer NOT NULL,
  iiddescuento integer,
  dfecha timestamp without time zone NOT NULL DEFAULT now(),
  vobservacionrealizado character varying,
  vobservacionrealizar character varying,
  iidcategoria integer,
  bactivo boolean NOT NULL DEFAULT true,
  bpagado boolean DEFAULT false,
  vestadoprocedimiento character varying DEFAULT 'REALIZADO'::character varying,
  vimagenodontograma text,
  CONSTRAINT odontblprocedimientospaciente_pkey PRIMARY KEY (iidprocedimiento),
  CONSTRAINT fk_proc_paciente FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT fk_proc_tratamiento FOREIGN KEY (iidtratamientodetalle) REFERENCES public.odontbltratamientodetalle(iidtratamientodetalle),
  CONSTRAINT fk_proc_doctor FOREIGN KEY (iiddoctor) REFERENCES public.odontbldoctores(iiddoctor),
  CONSTRAINT fk_proc_consultorio FOREIGN KEY (iidconsultorio) REFERENCES public.tblconsultorios(iidconsultorio),
  CONSTRAINT fk_proc_descuento FOREIGN KEY (iiddescuento) REFERENCES public.odontbldescuentos(iiddescuento),
  CONSTRAINT fk_proc_categoria FOREIGN KEY (iidcategoria) REFERENCES public.odontblcategorias(iidcategoria),
  CONSTRAINT fk_procedimiento_descuento FOREIGN KEY (iiddescuento) REFERENCES public.odontbldescuentos(iiddescuento)
);
CREATE TABLE public.odontblrecetas (
  iidreceta integer NOT NULL DEFAULT nextval('odontblrecetas_iidreceta_seq'::regclass),
  iidpaciente bigint NOT NULL,
  iidtratamientodetalle integer NOT NULL,
  iiddoctor integer NOT NULL,
  dfecha timestamp without time zone NOT NULL DEFAULT now(),
  bactivo boolean NOT NULL DEFAULT true,
  iidprocedimiento integer,
  v_ruta_pdf text,
  CONSTRAINT odontblrecetas_pkey PRIMARY KEY (iidreceta),
  CONSTRAINT fk_receta_paciente FOREIGN KEY (iidpaciente) REFERENCES public.odontblpacientes(iidpaciente),
  CONSTRAINT fk_receta_tratamiento FOREIGN KEY (iidtratamientodetalle) REFERENCES public.odontbltratamientodetalle(iidtratamientodetalle),
  CONSTRAINT fk_receta_doctor FOREIGN KEY (iiddoctor) REFERENCES public.odontbldoctores(iiddoctor),
  CONSTRAINT fk_receta_procedimiento FOREIGN KEY (iidprocedimiento) REFERENCES public.odontblprocedimientospaciente(iidprocedimiento)
);
CREATE TABLE public.odontblrecetasdetalle (
  iidrecetadetalle integer NOT NULL DEFAULT nextval('odontblrecetasdetalle_iidrecetadetalle_seq'::regclass),
  iidreceta integer NOT NULL,
  codncomercial character varying NOT NULL,
  vnombremedicamento character varying NOT NULL,
  icantidad integer NOT NULL DEFAULT 1 CHECK (icantidad > 0),
  vposologia character varying,
  CONSTRAINT odontblrecetasdetalle_pkey PRIMARY KEY (iidrecetadetalle),
  CONSTRAINT fk_recetadet_receta FOREIGN KEY (iidreceta) REFERENCES public.odontblrecetas(iidreceta),
  CONSTRAINT fk_recetadet_nombrecomercial FOREIGN KEY (codncomercial) REFERENCES public.vadncomercial(codncomercial)
);
CREATE TABLE public.odontbltratamientodetalle (
  sitratamiento integer NOT NULL,
  iidtratamientodetalle integer NOT NULL DEFAULT nextval('odontbltratamientodetalle_iidtratamientodetalle_seq'::regclass),
  vcodigo character varying NOT NULL UNIQUE,
  vdescripcion character varying NOT NULL,
  dvalortratamiento numeric DEFAULT 0 CHECK (dvalortratamiento >= 0::numeric),
  bestado boolean DEFAULT true,
  iid_iva integer,
  CONSTRAINT odontbltratamientodetalle_pkey PRIMARY KEY (iidtratamientodetalle),
  CONSTRAINT fk_detalle_tratamiento FOREIGN KEY (sitratamiento) REFERENCES public.odontbltratamientos(sitratamiento),
  CONSTRAINT odontbltratamientodetalle_iid_iva_fkey FOREIGN KEY (iid_iva) REFERENCES public.tbl_iva(iid_iva)
);
CREATE TABLE public.odontbltratamientos (
  sitratamiento integer NOT NULL DEFAULT nextval('odontbltratamientos_sitratamiento_seq'::regclass),
  iidcategoria integer NOT NULL,
  vcodigo character varying NOT NULL UNIQUE,
  vdesctratamiento character varying NOT NULL,
  dvalortratamiento numeric DEFAULT 0 CHECK (dvalortratamiento >= 0::numeric),
  bactivo boolean DEFAULT true,
  CONSTRAINT odontbltratamientos_pkey PRIMARY KEY (sitratamiento),
  CONSTRAINT fk_tratamiento_categoria FOREIGN KEY (iidcategoria) REFERENCES public.odontblcategorias(iidcategoria)
);
CREATE TABLE public.permisos_especificos (
  iidpermiso integer NOT NULL DEFAULT nextval('permisos_especificos_iidpermiso_seq'::regclass),
  iidmodulo integer NOT NULL,
  vcodigo character varying NOT NULL UNIQUE,
  vnombre character varying NOT NULL,
  vdescripcion character varying,
  vtipo character varying NOT NULL DEFAULT 'crud'::character varying CHECK (vtipo::text = ANY (ARRAY['crud'::character varying, 'action'::character varying, 'field'::character varying, 'report'::character varying, 'view'::character varying, 'approval'::character varying]::text[])),
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT permisos_especificos_pkey PRIMARY KEY (iidpermiso),
  CONSTRAINT fk_permiso_modulo FOREIGN KEY (iidmodulo) REFERENCES public.segtblmodulos(iidmodulo)
);
CREATE TABLE public.permisos_rol_especificos (
  iidrol integer NOT NULL,
  iidpermiso integer NOT NULL,
  bconcedido boolean NOT NULL DEFAULT true,
  CONSTRAINT permisos_rol_especificos_pkey PRIMARY KEY (iidrol, iidpermiso),
  CONSTRAINT fk_permisos_rol_esp_permiso FOREIGN KEY (iidpermiso) REFERENCES public.permisos_especificos(iidpermiso),
  CONSTRAINT fk_permisos_rol_esp_rol FOREIGN KEY (iidrol) REFERENCES public.roles(iidrol)
);
CREATE TABLE public.personas (
  iidpersona integer NOT NULL DEFAULT nextval('personas_iidpersona_seq'::regclass),
  vcedula character varying UNIQUE,
  vnombres character varying NOT NULL CHECK (length(TRIM(BOTH FROM vnombres)) > 0),
  vapellidos character varying NOT NULL,
  vemail character varying,
  vtelefono character varying,
  vcelular character varying,
  dfechanacimiento date,
  vdireccionfoto character varying,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT personas_pkey PRIMARY KEY (iidpersona)
);
CREATE TABLE public.roles (
  iidrol integer NOT NULL DEFAULT nextval('roles_iidrol_seq'::regclass),
  vnombrerol character varying NOT NULL UNIQUE,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT roles_pkey PRIMARY KEY (iidrol)
);
CREATE TABLE public.seg_rol_entidades_facturadoras (
  iid integer NOT NULL DEFAULT nextval('seg_rol_entidades_facturadoras_iid_seq'::regclass),
  iidrol integer NOT NULL,
  iid_entidad_facturadora integer NOT NULL,
  CONSTRAINT seg_rol_entidades_facturadoras_pkey PRIMARY KEY (iid),
  CONSTRAINT fk_ref_rol FOREIGN KEY (iidrol) REFERENCES public.roles(iidrol),
  CONSTRAINT fk_ref_entidad FOREIGN KEY (iid_entidad_facturadora) REFERENCES public.tbl_entidades_facturadoras(iid_entidad_facturadora)
);
CREATE TABLE public.seg_rol_establecimientos (
  iid integer NOT NULL DEFAULT nextval('seg_rol_establecimientos_iid_seq'::regclass),
  iidrol integer NOT NULL,
  iid_establecimiento integer NOT NULL,
  CONSTRAINT seg_rol_establecimientos_pkey PRIMARY KEY (iid),
  CONSTRAINT fk_rest_rol FOREIGN KEY (iidrol) REFERENCES public.roles(iidrol),
  CONSTRAINT fk_rest_est FOREIGN KEY (iid_establecimiento) REFERENCES public.tbl_entidades_establecimientos(iid_establecimiento)
);
CREATE TABLE public.seg_rol_puntos_emision (
  iid integer NOT NULL DEFAULT nextval('seg_rol_puntos_emision_iid_seq'::regclass),
  iidrol integer NOT NULL,
  iid_punto_emision integer NOT NULL,
  CONSTRAINT seg_rol_puntos_emision_pkey PRIMARY KEY (iid),
  CONSTRAINT fk_rpe_rol FOREIGN KEY (iidrol) REFERENCES public.roles(iidrol),
  CONSTRAINT fk_rpe_punto FOREIGN KEY (iid_punto_emision) REFERENCES public.tbl_entidades_puntos_emision(iid_punto_emision)
);
CREATE TABLE public.seg_usuario_entidades_facturadoras (
  iid integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_usuario integer NOT NULL,
  iid_entidad_facturadora integer NOT NULL,
  b_activo boolean NOT NULL DEFAULT true,
  CONSTRAINT seg_usuario_entidades_facturadoras_pkey PRIMARY KEY (iid),
  CONSTRAINT fk_usu_ent_usuario FOREIGN KEY (iid_usuario) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_usu_ent_entidad FOREIGN KEY (iid_entidad_facturadora) REFERENCES public.tbl_entidades_facturadoras(iid_entidad_facturadora)
);
CREATE TABLE public.seg_usuario_establecimientos (
  iid integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_usuario integer NOT NULL,
  iid_establecimiento integer NOT NULL,
  b_activo boolean NOT NULL DEFAULT true,
  CONSTRAINT seg_usuario_establecimientos_pkey PRIMARY KEY (iid),
  CONSTRAINT fk_usu_est_usuario FOREIGN KEY (iid_usuario) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_usu_est_establecimiento FOREIGN KEY (iid_establecimiento) REFERENCES public.tbl_entidades_establecimientos(iid_establecimiento)
);
CREATE TABLE public.seg_usuario_puntos_emision (
  iid_usuario_punto integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_usuario integer NOT NULL,
  iid_punto_emision integer NOT NULL,
  b_por_defecto boolean DEFAULT false,
  b_activo boolean DEFAULT true,
  CONSTRAINT seg_usuario_puntos_emision_pkey PRIMARY KEY (iid_usuario_punto),
  CONSTRAINT fk_usu_pto_usuario FOREIGN KEY (iid_usuario) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_usu_pto_punto FOREIGN KEY (iid_punto_emision) REFERENCES public.tbl_entidades_puntos_emision(iid_punto_emision)
);
CREATE TABLE public.segtblmodulos (
  iidmodulo integer NOT NULL DEFAULT nextval('segtblmodulos_seq'::regclass),
  vcodigo character varying NOT NULL,
  vnombre character varying NOT NULL,
  vdescripcion character varying,
  bactivo boolean NOT NULL DEFAULT true,
  iidmodulo_padre integer,
  iorden integer DEFAULT 0,
  CONSTRAINT segtblmodulos_pkey PRIMARY KEY (iidmodulo),
  CONSTRAINT fk_modulo_padre FOREIGN KEY (iidmodulo_padre) REFERENCES public.segtblmodulos(iidmodulo)
);
CREATE TABLE public.segtblpermisosusuario (
  vusuario character varying NOT NULL,
  iidmodulo integer NOT NULL,
  iidpermiso_especifico integer NOT NULL,
  CONSTRAINT segtblpermisosusuario_pkey PRIMARY KEY (vusuario, iidpermiso_especifico),
  CONSTRAINT fk_permisos_modulo FOREIGN KEY (iidmodulo) REFERENCES public.segtblmodulos(iidmodulo),
  CONSTRAINT fk_permisos_usuario_especifico FOREIGN KEY (iidpermiso_especifico) REFERENCES public.permisos_especificos(iidpermiso)
);
CREATE TABLE public.segtblusuarios (
  vusuario character varying NOT NULL UNIQUE,
  vclave character varying NOT NULL,
  iid integer NOT NULL DEFAULT nextval('segtblusuarios_iid_seq'::regclass),
  iidpersona integer NOT NULL UNIQUE,
  CONSTRAINT segtblusuarios_pkey PRIMARY KEY (iid),
  CONSTRAINT fk_usuario_persona FOREIGN KEY (iidpersona) REFERENCES public.personas(iidpersona)
);
CREATE TABLE public.servicios_externos (
  iidservicio integer NOT NULL DEFAULT nextval('servicios_externos_iidservicio_seq'::regclass),
  vnombreservicio character varying NOT NULL UNIQUE,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT servicios_externos_pkey PRIMARY KEY (iidservicio)
);
CREATE TABLE public.tbl_activos (
  iid_activo integer NOT NULL DEFAULT nextval('tbl_activos_iid_activo_seq'::regclass),
  iid_nombre_activo integer NOT NULL,
  vdescripcion_extendida text,
  vnumero_serie character varying,
  iid_familia_activo integer NOT NULL,
  iid_marca_activo integer NOT NULL,
  iid_modelo_activo integer NOT NULL,
  iid_clase_activo integer NOT NULL,
  iid_uso_activo integer NOT NULL,
  iid_estado_activo integer NOT NULL,
  iid_factura_compra integer,
  iid_proveedor integer NOT NULL,
  n_valor_adquisicion numeric NOT NULL CHECK (n_valor_adquisicion >= 0::numeric),
  d_fecha_adquisicion date NOT NULL,
  btiene_garantia boolean NOT NULL DEFAULT false,
  iyears_garantia integer,
  iid_bodega integer,
  iid_seguro integer,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_activos_pkey PRIMARY KEY (iid_activo),
  CONSTRAINT fk_activo_nombre FOREIGN KEY (iid_nombre_activo) REFERENCES public.nombre_activos(iid_nombre_activo),
  CONSTRAINT fk_activo_familia FOREIGN KEY (iid_familia_activo) REFERENCES public.familia_activos(iid_familia_activo),
  CONSTRAINT fk_activo_marca FOREIGN KEY (iid_marca_activo) REFERENCES public.marca_activos(iid_marca_activo),
  CONSTRAINT fk_activo_modelo FOREIGN KEY (iid_modelo_activo) REFERENCES public.modelo_activos(iid_modelo_activo),
  CONSTRAINT fk_activo_clase FOREIGN KEY (iid_clase_activo) REFERENCES public.clase_activos(iid_clase_activo),
  CONSTRAINT fk_activo_uso FOREIGN KEY (iid_uso_activo) REFERENCES public.uso_activos(iid_uso_activo),
  CONSTRAINT fk_activo_estado FOREIGN KEY (iid_estado_activo) REFERENCES public.estado_activos(iid_estado_activo),
  CONSTRAINT fk_activo_factura FOREIGN KEY (iid_factura_compra) REFERENCES public.tbl_facturas_compra(iid_factura_compra),
  CONSTRAINT fk_activo_proveedor FOREIGN KEY (iid_proveedor) REFERENCES public.tbl_proveedores(iid_proveedor),
  CONSTRAINT fk_activo_bodega FOREIGN KEY (iid_bodega) REFERENCES public.tbl_bodegas(iid_bodega),
  CONSTRAINT fk_activo_seguro FOREIGN KEY (iid_seguro) REFERENCES public.tbl_seguros(iid_seguro)
);
CREATE TABLE public.tbl_bodegas (
  iid_bodega integer NOT NULL DEFAULT nextval('tbl_bodegas_iid_bodega_seq'::regclass),
  vnombre_bodega character varying NOT NULL UNIQUE,
  iid_tipo_bodega integer,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_bodegas_pkey PRIMARY KEY (iid_bodega),
  CONSTRAINT tbl_bodegas_iid_tipo_bodega_fkey FOREIGN KEY (iid_tipo_bodega) REFERENCES public.tbl_tipos_bodega(iid_tipo_bodega)
);
CREATE TABLE public.tbl_caracteristicas (
  iid_caracteristica integer NOT NULL DEFAULT nextval('tbl_caracteristicas_iid_caracteristica_seq'::regclass),
  vnombre_caracteristica character varying NOT NULL UNIQUE,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_caracteristicas_pkey PRIMARY KEY (iid_caracteristica)
);
CREATE TABLE public.tbl_entidades_establecimientos (
  iid_establecimiento integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_entidad_facturadora integer NOT NULL,
  v_cod_establecimiento character varying NOT NULL,
  v_nombre_comercial character varying,
  v_direccion character varying NOT NULL,
  b_es_matriz boolean NOT NULL DEFAULT false,
  v_estado_sri character varying DEFAULT 'ABIERTO'::character varying,
  b_activo boolean NOT NULL DEFAULT true,
  d_fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tbl_entidades_establecimientos_pkey PRIMARY KEY (iid_establecimiento),
  CONSTRAINT fk_establecimiento_entidad FOREIGN KEY (iid_entidad_facturadora) REFERENCES public.tbl_entidades_facturadoras(iid_entidad_facturadora)
);
CREATE TABLE public.tbl_entidades_facturadoras (
  iid_entidad_facturadora integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  v_ruc character varying NOT NULL UNIQUE CHECK (length(v_ruc::text) = 13),
  v_razon_social character varying NOT NULL,
  v_direccion_matriz character varying,
  v_telefono character varying,
  v_email character varying,
  b_activo boolean NOT NULL DEFAULT true,
  d_fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  v_ruta_certificado_p12 character varying,
  v_nombre_archivo_p12 character varying,
  v_clave_certificado_enc character varying,
  d_fecha_vencimiento_cert date,
  v_ambiente character varying DEFAULT 'PRUEBAS'::character varying CHECK (v_ambiente::text = ANY (ARRAY['PRUEBAS'::character varying, 'PRODUCCION'::character varying]::text[])),
  v_ruta_logo character varying,
  b_obligado_contabilidad boolean NOT NULL DEFAULT false,
  v_contribuyente_especial character varying,
  v_agente_retencion character varying,
  v_regimen_fiscal character varying,
  CONSTRAINT tbl_entidades_facturadoras_pkey PRIMARY KEY (iid_entidad_facturadora)
);
CREATE TABLE public.tbl_entidades_puntos_emision (
  iid_punto_emision integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_establecimiento integer NOT NULL,
  v_cod_punto_emision character varying NOT NULL,
  v_nombre_caja character varying NOT NULL,
  i_secuencial_factura integer NOT NULL DEFAULT 0,
  b_activo boolean NOT NULL DEFAULT true,
  i_secuencial_nota_credito integer NOT NULL DEFAULT 0,
  i_secuencial_nota_debito integer NOT NULL DEFAULT 0,
  CONSTRAINT tbl_entidades_puntos_emision_pkey PRIMARY KEY (iid_punto_emision),
  CONSTRAINT fk_punto_establecimiento FOREIGN KEY (iid_establecimiento) REFERENCES public.tbl_entidades_establecimientos(iid_establecimiento)
);
CREATE TABLE public.tbl_estados_fisicos (
  iid_estado_fisico integer NOT NULL DEFAULT nextval('tbl_estados_fisicos_iid_estado_fisico_seq'::regclass),
  vnombre_estado character varying NOT NULL UNIQUE,
  vdescripcion character varying,
  iporcentaje_condicion integer CHECK (iporcentaje_condicion >= 0 AND iporcentaje_condicion <= 100),
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_estados_fisicos_pkey PRIMARY KEY (iid_estado_fisico)
);
CREATE TABLE public.tbl_estados_operativos (
  iid_estado_operativo integer NOT NULL DEFAULT nextval('tbl_estados_operativos_iid_estado_operativo_seq'::regclass),
  vnombre_estado character varying NOT NULL UNIQUE,
  vdescripcion character varying,
  bactivo boolean NOT NULL DEFAULT true,
  dfecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tbl_estados_operativos_pkey PRIMARY KEY (iid_estado_operativo)
);
CREATE TABLE public.tbl_estados_pedido (
  iid_estado_pedido integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  v_descripcion character varying NOT NULL,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_estados_pedido_pkey PRIMARY KEY (iid_estado_pedido)
);
CREATE TABLE public.tbl_estados_requisicion (
  iid_estado_requisicion integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  v_descripcion character varying NOT NULL,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_estados_requisicion_pkey PRIMARY KEY (iid_estado_requisicion)
);
CREATE TABLE public.tbl_facturas_compra (
  iid_factura_compra integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_entidad_facturadora integer NOT NULL,
  v_numero_factura character varying NOT NULL,
  v_clave_acceso character varying UNIQUE,
  v_numero_autorizacion character varying,
  d_fecha_factura date NOT NULL,
  d_fecha_autorizacion timestamp without time zone,
  n_subtotal_0 numeric NOT NULL DEFAULT 0.00,
  n_subtotal_iva numeric NOT NULL DEFAULT 0.00,
  n_subtotal numeric NOT NULL,
  n_iva numeric NOT NULL,
  n_descuento numeric NOT NULL DEFAULT 0.00,
  n_total numeric NOT NULL,
  d_fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  iid_usuario_registra integer NOT NULL,
  v_ruta_xml character varying,
  v_ruta_pdf character varying,
  CONSTRAINT tbl_facturas_compra_pkey PRIMARY KEY (iid_factura_compra),
  CONSTRAINT fk_factura_entidad FOREIGN KEY (iid_entidad_facturadora) REFERENCES public.tbl_entidades_facturadoras(iid_entidad_facturadora),
  CONSTRAINT fk_factura_usuario FOREIGN KEY (iid_usuario_registra) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.tbl_historial_precios_productos (
  iid_historial_precio integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_inventario integer NOT NULL,
  iid_proveedor integer NOT NULL,
  n_precio_compra numeric NOT NULL CHECK (n_precio_compra >= 0::numeric),
  iid_pedido integer,
  iid_factura_compra integer,
  d_fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  d_fecha_factura date,
  iid_usuario_registra integer NOT NULL,
  v_observaciones text,
  CONSTRAINT tbl_historial_precios_productos_pkey PRIMARY KEY (iid_historial_precio),
  CONSTRAINT fk_hist_precio_factura FOREIGN KEY (iid_factura_compra) REFERENCES public.tbl_facturas_compra(iid_factura_compra),
  CONSTRAINT fk_hist_precio_inventario FOREIGN KEY (iid_inventario) REFERENCES public.tbl_inventario_productos(iid_inventario),
  CONSTRAINT fk_hist_precio_proveedor FOREIGN KEY (iid_proveedor) REFERENCES public.tbl_proveedores(iid_proveedor),
  CONSTRAINT fk_hist_precio_usuario FOREIGN KEY (iid_usuario_registra) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_hist_precio_pedido FOREIGN KEY (iid_pedido) REFERENCES public.tbl_pedidos_cab(iid_pedido)
);
CREATE TABLE public.tbl_historial_stock (
  iid_historial integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_inventario integer NOT NULL,
  iid_tipo_movimiento integer NOT NULL,
  fecha_movimiento timestamp without time zone DEFAULT now(),
  cantidad numeric NOT NULL,
  stock_anterior numeric NOT NULL,
  stock_actual numeric NOT NULL,
  iid_pedido_det integer,
  iid_procedimiento integer,
  iid_bodega integer,
  CONSTRAINT tbl_historial_stock_pkey PRIMARY KEY (iid_historial),
  CONSTRAINT fk_historial_inventario FOREIGN KEY (iid_inventario) REFERENCES public.tbl_inventario_productos(iid_inventario),
  CONSTRAINT fk_historial_tipo FOREIGN KEY (iid_tipo_movimiento) REFERENCES public.tbl_tipos_movimiento(iid_tipo_movimiento),
  CONSTRAINT fk_historial_pedido FOREIGN KEY (iid_pedido_det) REFERENCES public.tbl_pedidos_det(iid_pedido_det),
  CONSTRAINT fk_historial_procedimiento FOREIGN KEY (iid_procedimiento) REFERENCES public.odontblprocedimientospaciente(iidprocedimiento),
  CONSTRAINT fk_historial_bodega FOREIGN KEY (iid_bodega) REFERENCES public.tbl_bodegas(iid_bodega)
);
CREATE TABLE public.tbl_inv_clasificacion (
  iid_clasificacion integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  v_descripcion character varying NOT NULL,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_inv_clasificacion_pkey PRIMARY KEY (iid_clasificacion)
);
CREATE TABLE public.tbl_inv_subclasificacion (
  iid_subclasificacion integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_clasificacion integer NOT NULL,
  v_codigo character varying,
  v_descripcion character varying NOT NULL,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_inv_subclasificacion_pkey PRIMARY KEY (iid_subclasificacion),
  CONSTRAINT fk_inv_clasificacion FOREIGN KEY (iid_clasificacion) REFERENCES public.tbl_inv_clasificacion(iid_clasificacion)
);
CREATE TABLE public.tbl_inventario_productos (
  codigo_producto character varying NOT NULL UNIQUE,
  iid_subclasificacion integer NOT NULL,
  iid_nombre integer NOT NULL,
  iid_caracteristica integer NOT NULL,
  iid_marca integer NOT NULL,
  unidad_compra integer NOT NULL,
  unidad_consumo integer NOT NULL,
  cantidad_minima numeric NOT NULL,
  estado boolean NOT NULL,
  es_de_conteo boolean NOT NULL,
  iid_inventario integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_iva integer,
  CONSTRAINT tbl_inventario_productos_pkey PRIMARY KEY (iid_inventario),
  CONSTRAINT fk_inventario_iva FOREIGN KEY (iid_iva) REFERENCES public.tbl_iva(iid_iva),
  CONSTRAINT fk_inventario_producto FOREIGN KEY (iid_nombre) REFERENCES public.tbl_productos(iid_nombre),
  CONSTRAINT fk_inventario_caracteristica FOREIGN KEY (iid_caracteristica) REFERENCES public.tbl_caracteristicas(iid_caracteristica),
  CONSTRAINT fk_inventario_marca FOREIGN KEY (iid_marca) REFERENCES public.tbl_marcas(iid_marca),
  CONSTRAINT fk_inventario_subclasificacion FOREIGN KEY (iid_subclasificacion) REFERENCES public.tbl_inv_subclasificacion(iid_subclasificacion),
  CONSTRAINT fk_inventario_unidad_compra FOREIGN KEY (unidad_compra) REFERENCES public.unidades_medida(iidunidad),
  CONSTRAINT fk_inventario_unidad_consumo FOREIGN KEY (unidad_consumo) REFERENCES public.unidades_medida(iidunidad)
);
CREATE TABLE public.tbl_iva (
  iid_iva integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  n_porcentaje numeric NOT NULL CHECK (n_porcentaje >= 0::numeric AND n_porcentaje <= 100::numeric),
  d_fecha_vigencia_desde date NOT NULL,
  d_fecha_vigencia_hasta date,
  b_activo boolean NOT NULL DEFAULT true,
  v_codigo_sri character varying,
  CONSTRAINT tbl_iva_pkey PRIMARY KEY (iid_iva)
);
CREATE TABLE public.tbl_listas_precios (
  iid_lista_precio integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  v_nombre_lista character varying NOT NULL UNIQUE,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_listas_precios_pkey PRIMARY KEY (iid_lista_precio)
);
CREATE TABLE public.tbl_marcas (
  iid_marca integer NOT NULL DEFAULT nextval('tbl_marcas_iid_marca_seq'::regclass),
  vnombre_marca character varying NOT NULL UNIQUE,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_marcas_pkey PRIMARY KEY (iid_marca)
);
CREATE TABLE public.tbl_modelos (
  iid_modelo integer NOT NULL DEFAULT nextval('tbl_modelos_iid_modelo_seq'::regclass),
  vnombre_modelo character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_modelos_pkey PRIMARY KEY (iid_modelo)
);
CREATE TABLE public.tbl_pedidos_cab (
  iid_pedido integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_tipo_pedido integer NOT NULL,
  iid_bodega_destino integer,
  iid_proveedor integer,
  iid_estado_pedido integer NOT NULL DEFAULT 1,
  d_fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  iid_usuario_solicita integer NOT NULL,
  v_motivo_rechazo text,
  CONSTRAINT tbl_pedidos_cab_pkey PRIMARY KEY (iid_pedido),
  CONSTRAINT fk_ped_tipo FOREIGN KEY (iid_tipo_pedido) REFERENCES public.tbl_tipos_pedido(iid_tipo_pedido),
  CONSTRAINT fk_ped_bodega_destino FOREIGN KEY (iid_bodega_destino) REFERENCES public.tbl_bodegas(iid_bodega),
  CONSTRAINT fk_ped_proveedor FOREIGN KEY (iid_proveedor) REFERENCES public.tbl_proveedores(iid_proveedor),
  CONSTRAINT fk_ped_estado FOREIGN KEY (iid_estado_pedido) REFERENCES public.tbl_estados_pedido(iid_estado_pedido),
  CONSTRAINT fk_ped_usu_solicita FOREIGN KEY (iid_usuario_solicita) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.tbl_pedidos_det (
  iid_pedido_det integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_pedido integer NOT NULL,
  iid_inventario integer NOT NULL,
  cantidad_solicitada numeric NOT NULL CHECK (cantidad_solicitada > 0::numeric),
  cantidad_cotizada numeric CHECK (cantidad_cotizada >= 0::numeric),
  cantidad_recibida numeric CHECK (cantidad_recibida >= 0::numeric),
  n_precio_unitario numeric CHECK (n_precio_unitario >= 0::numeric),
  n_subtotal_linea numeric,
  iid_iva integer,
  n_porcentaje_iva_aplicado numeric DEFAULT 0.00 CHECK (n_porcentaje_iva_aplicado >= 0::numeric AND n_porcentaje_iva_aplicado <= 100::numeric),
  n_iva_linea numeric DEFAULT 0.00 CHECK (n_iva_linea >= 0::numeric),
  n_total_linea numeric CHECK (n_total_linea >= 0::numeric),
  CONSTRAINT tbl_pedidos_det_pkey PRIMARY KEY (iid_pedido_det),
  CONSTRAINT fk_pedidos_det_iva FOREIGN KEY (iid_iva) REFERENCES public.tbl_iva(iid_iva),
  CONSTRAINT fk_ped_det_cab FOREIGN KEY (iid_pedido) REFERENCES public.tbl_pedidos_cab(iid_pedido),
  CONSTRAINT fk_ped_det_inventario FOREIGN KEY (iid_inventario) REFERENCES public.tbl_inventario_productos(iid_inventario)
);
CREATE TABLE public.tbl_pedidos_historial (
  iid_historial integer NOT NULL DEFAULT nextval('tbl_pedidos_historial_iid_historial_seq'::regclass),
  iid_pedido integer NOT NULL,
  iid_usuario integer NOT NULL,
  d_fecha_cambio timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  v_observaciones text,
  v_accion character varying,
  CONSTRAINT tbl_pedidos_historial_pkey PRIMARY KEY (iid_historial),
  CONSTRAINT fk_hist_pedido FOREIGN KEY (iid_pedido) REFERENCES public.tbl_pedidos_cab(iid_pedido),
  CONSTRAINT fk_hist_usuario FOREIGN KEY (iid_usuario) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.tbl_precios_compra (
  iid_precio_compra integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_producto integer NOT NULL,
  iid_proveedor integer NOT NULL,
  val_costo numeric NOT NULL CHECK (val_costo >= 0::numeric),
  d_fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_precios_compra_pkey PRIMARY KEY (iid_precio_compra),
  CONSTRAINT fk_precio_compra_prod FOREIGN KEY (iid_producto) REFERENCES public.tbl_productos(iid_nombre),
  CONSTRAINT fk_precio_compra_prov FOREIGN KEY (iid_proveedor) REFERENCES public.tbl_proveedores(iid_proveedor)
);
CREATE TABLE public.tbl_precios_productos_proveedores (
  iid_precio_proveedor integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_inventario integer NOT NULL,
  iid_proveedor integer NOT NULL,
  n_precio_compra numeric NOT NULL CHECK (n_precio_compra >= 0::numeric),
  d_fecha_ultimo_precio date NOT NULL,
  iid_usuario_actualiza integer NOT NULL,
  d_fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  b_activo boolean DEFAULT true,
  v_observaciones text,
  CONSTRAINT tbl_precios_productos_proveedores_pkey PRIMARY KEY (iid_precio_proveedor),
  CONSTRAINT fk_precio_prov_inventario FOREIGN KEY (iid_inventario) REFERENCES public.tbl_inventario_productos(iid_inventario),
  CONSTRAINT fk_precio_prov_proveedor FOREIGN KEY (iid_proveedor) REFERENCES public.tbl_proveedores(iid_proveedor),
  CONSTRAINT fk_precio_prov_usuario FOREIGN KEY (iid_usuario_actualiza) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.tbl_precios_venta (
  iid_precio_venta integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_producto integer NOT NULL,
  iid_lista_precio integer NOT NULL,
  val_precio_venta numeric NOT NULL CHECK (val_precio_venta >= 0::numeric),
  porcentaje_utilidad numeric,
  d_fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_precios_venta_pkey PRIMARY KEY (iid_precio_venta),
  CONSTRAINT fk_precio_venta_prod FOREIGN KEY (iid_producto) REFERENCES public.tbl_productos(iid_nombre),
  CONSTRAINT fk_precio_venta_lista FOREIGN KEY (iid_lista_precio) REFERENCES public.tbl_listas_precios(iid_lista_precio)
);
CREATE TABLE public.tbl_productos (
  iid_nombre integer NOT NULL DEFAULT nextval('tbl_productos_iid_nombre_seq'::regclass),
  vnombre_producto character varying NOT NULL UNIQUE,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_productos_pkey PRIMARY KEY (iid_nombre)
);
CREATE TABLE public.tbl_proveedores (
  iid_proveedor integer NOT NULL DEFAULT nextval('tbl_proveedores_iid_proveedor_seq'::regclass),
  vnombre character varying NOT NULL,
  vruc character varying UNIQUE,
  vtelefono character varying,
  vfax character varying,
  vemail character varying,
  itipo_proveedor integer DEFAULT 1,
  iid_pais integer NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_proveedores_pkey PRIMARY KEY (iid_proveedor),
  CONSTRAINT tbl_proveedores_itipo_proveedor_fkey FOREIGN KEY (itipo_proveedor) REFERENCES public.tbl_tipos_proveedor(iid_tipo_proveedor),
  CONSTRAINT tbl_proveedores_iid_pais_fkey FOREIGN KEY (iid_pais) REFERENCES public.tblpaises(iidpais)
);
CREATE TABLE public.tbl_proveedores_direcciones (
  iid_direccion integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_proveedor integer NOT NULL,
  v_direccion text NOT NULL,
  v_tipo_direccion character varying,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_proveedores_direcciones_pkey PRIMARY KEY (iid_direccion),
  CONSTRAINT fk_direccion_proveedor FOREIGN KEY (iid_proveedor) REFERENCES public.tbl_proveedores(iid_proveedor)
);
CREATE TABLE public.tbl_rel_factura_pedido (
  iid_rel_factura_pedido integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_factura_compra integer NOT NULL,
  iid_pedido integer NOT NULL UNIQUE,
  CONSTRAINT tbl_rel_factura_pedido_pkey PRIMARY KEY (iid_rel_factura_pedido),
  CONSTRAINT fk_rel_factura FOREIGN KEY (iid_factura_compra) REFERENCES public.tbl_facturas_compra(iid_factura_compra),
  CONSTRAINT fk_rel_pedido FOREIGN KEY (iid_pedido) REFERENCES public.tbl_pedidos_cab(iid_pedido)
);
CREATE TABLE public.tbl_requisiciones_cab (
  iid_requisicion integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_bodega_solicita integer NOT NULL,
  iid_bodega_origen integer NOT NULL,
  iid_estado_requisicion integer NOT NULL DEFAULT 1,
  d_fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  iid_usuario_solicita integer NOT NULL,
  d_fecha_aprobacion timestamp without time zone,
  iid_usuario_aprueba integer,
  d_fecha_entrega timestamp without time zone,
  iid_usuario_entrega integer,
  CONSTRAINT tbl_requisiciones_cab_pkey PRIMARY KEY (iid_requisicion),
  CONSTRAINT fk_req_bodega_solicita FOREIGN KEY (iid_bodega_solicita) REFERENCES public.tbl_bodegas(iid_bodega),
  CONSTRAINT fk_req_bodega_origen FOREIGN KEY (iid_bodega_origen) REFERENCES public.tbl_bodegas(iid_bodega),
  CONSTRAINT fk_req_estado FOREIGN KEY (iid_estado_requisicion) REFERENCES public.tbl_estados_requisicion(iid_estado_requisicion),
  CONSTRAINT fk_req_usu_solicita FOREIGN KEY (iid_usuario_solicita) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_req_usu_aprueba FOREIGN KEY (iid_usuario_aprueba) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_req_usu_entrega FOREIGN KEY (iid_usuario_entrega) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.tbl_requisiciones_det (
  iid_requisicion_det integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_requisicion integer NOT NULL,
  iid_inventario integer NOT NULL,
  cantidad_solicitada numeric NOT NULL CHECK (cantidad_solicitada > 0::numeric),
  cantidad_aprobada numeric CHECK (cantidad_aprobada >= 0::numeric),
  CONSTRAINT tbl_requisiciones_det_pkey PRIMARY KEY (iid_requisicion_det),
  CONSTRAINT fk_req_det_cab FOREIGN KEY (iid_requisicion) REFERENCES public.tbl_requisiciones_cab(iid_requisicion),
  CONSTRAINT fk_req_det_inventario FOREIGN KEY (iid_inventario) REFERENCES public.tbl_inventario_productos(iid_inventario)
);
CREATE TABLE public.tbl_requisiciones_historial (
  iid_historial integer NOT NULL DEFAULT nextval('tbl_requisiciones_historial_iid_historial_seq'::regclass),
  iid_requisicion integer NOT NULL,
  iid_usuario integer NOT NULL,
  d_fecha_cambio timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  v_observaciones text,
  v_accion character varying,
  iid_estado_requisicion integer,
  CONSTRAINT tbl_requisiciones_historial_pkey PRIMARY KEY (iid_historial),
  CONSTRAINT fk_hist_req_requisicion FOREIGN KEY (iid_requisicion) REFERENCES public.tbl_requisiciones_cab(iid_requisicion),
  CONSTRAINT fk_hist_req_usuario FOREIGN KEY (iid_usuario) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_hist_req_estado FOREIGN KEY (iid_estado_requisicion) REFERENCES public.tbl_estados_requisicion(iid_estado_requisicion)
);
CREATE TABLE public.tbl_seguros (
  iid_seguro integer NOT NULL DEFAULT nextval('tbl_seguros_iid_seguro_seq'::regclass),
  iid_proveedor integer NOT NULL,
  vnumero_poliza character varying,
  d_fecha_inicio date NOT NULL,
  d_fecha_fin date NOT NULL,
  n_monto_asegurado numeric CHECK (n_monto_asegurado IS NULL OR n_monto_asegurado >= 0::numeric),
  vobservaciones text,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_seguros_pkey PRIMARY KEY (iid_seguro),
  CONSTRAINT fk_seguro_proveedor FOREIGN KEY (iid_proveedor) REFERENCES public.tbl_proveedores(iid_proveedor)
);
CREATE TABLE public.tbl_stock_global (
  iid_stock integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  iid_inventario integer NOT NULL,
  stock_actual numeric NOT NULL DEFAULT 0.00 CHECK (stock_actual >= 0::numeric),
  stock_minimo numeric NOT NULL DEFAULT 0.00,
  fecha_ultima_actualizacion timestamp without time zone DEFAULT now(),
  iid_bodega integer NOT NULL,
  CONSTRAINT tbl_stock_global_pkey PRIMARY KEY (iid_stock),
  CONSTRAINT fk_stock_inventario FOREIGN KEY (iid_inventario) REFERENCES public.tbl_inventario_productos(iid_inventario),
  CONSTRAINT fk_stock_bodega FOREIGN KEY (iid_bodega) REFERENCES public.tbl_bodegas(iid_bodega)
);
CREATE TABLE public.tbl_tipos_bodega (
  iid_tipo_bodega integer NOT NULL DEFAULT nextval('tbl_tipos_bodega_iid_tipo_bodega_seq'::regclass),
  vnombre_tipo character varying NOT NULL UNIQUE,
  vdescripcion character varying,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_tipos_bodega_pkey PRIMARY KEY (iid_tipo_bodega)
);
CREATE TABLE public.tbl_tipos_instrumental (
  iid_tipo_instrumental integer NOT NULL DEFAULT nextval('tbl_tipos_instrumental_iid_tipo_instrumental_seq'::regclass),
  vnombre_tipo character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_tipos_instrumental_pkey PRIMARY KEY (iid_tipo_instrumental)
);
CREATE TABLE public.tbl_tipos_movimiento (
  iid_tipo_movimiento integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  vnombre character varying NOT NULL,
  vaccion character NOT NULL CHECK (vaccion = ANY (ARRAY['S'::bpchar, 'R'::bpchar])),
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_tipos_movimiento_pkey PRIMARY KEY (iid_tipo_movimiento)
);
CREATE TABLE public.tbl_tipos_pedido (
  iid_tipo_pedido integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  v_descripcion character varying NOT NULL,
  b_activo boolean DEFAULT true,
  CONSTRAINT tbl_tipos_pedido_pkey PRIMARY KEY (iid_tipo_pedido)
);
CREATE TABLE public.tbl_tipos_proveedor (
  iid_tipo_proveedor integer NOT NULL DEFAULT nextval('tbl_tipos_proveedor_iid_tipo_proveedor_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tbl_tipos_proveedor_pkey PRIMARY KEY (iid_tipo_proveedor)
);
CREATE TABLE public.tbl_transferencias_activos (
  iid_transferencia integer NOT NULL DEFAULT nextval('tbl_transferencias_activos_iid_transferencia_seq'::regclass),
  iid_activo integer NOT NULL,
  iid_bodega_origen integer,
  iid_bodega_destino integer NOT NULL,
  iid_usuario_autoriza integer NOT NULL,
  iid_usuario_registra integer NOT NULL,
  d_fecha_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  vobservaciones text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tbl_transferencias_activos_pkey PRIMARY KEY (iid_transferencia),
  CONSTRAINT fk_transferencia_activo FOREIGN KEY (iid_activo) REFERENCES public.tbl_activos(iid_activo),
  CONSTRAINT fk_transferencia_bodega_origen FOREIGN KEY (iid_bodega_origen) REFERENCES public.tbl_bodegas(iid_bodega),
  CONSTRAINT fk_transferencia_bodega_destino FOREIGN KEY (iid_bodega_destino) REFERENCES public.tbl_bodegas(iid_bodega),
  CONSTRAINT fk_transferencia_usuario_autoriza FOREIGN KEY (iid_usuario_autoriza) REFERENCES public.segtblusuarios(iid),
  CONSTRAINT fk_transferencia_usuario_registra FOREIGN KEY (iid_usuario_registra) REFERENCES public.segtblusuarios(iid)
);
CREATE TABLE public.tbl_tratamiento_recetas (
  iid_receta integer NOT NULL DEFAULT nextval('tbl_tratamiento_recetas_iid_receta_seq'::regclass),
  iidtratamientodetalle integer NOT NULL,
  iid_inventario integer NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1.00,
  CONSTRAINT tbl_tratamiento_recetas_pkey PRIMARY KEY (iid_receta),
  CONSTRAINT fk_receta_tratamiento FOREIGN KEY (iidtratamientodetalle) REFERENCES public.odontbltratamientodetalle(iidtratamientodetalle),
  CONSTRAINT fk_receta_inventario FOREIGN KEY (iid_inventario) REFERENCES public.tbl_inventario_productos(iid_inventario)
);
CREATE TABLE public.tblcargos (
  iidcargo integer NOT NULL DEFAULT nextval('tblcargos_iidcargo_seq'::regclass),
  vnombrecargo character varying NOT NULL UNIQUE,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tblcargos_pkey PRIMARY KEY (iidcargo)
);
CREATE TABLE public.tblciudades (
  iidciudad integer NOT NULL,
  iidpais integer NOT NULL,
  vcodigo character varying,
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  iidprovincia integer
);
CREATE TABLE public.tblconsultorios (
  iidconsultorio integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  vnombre character varying NOT NULL,
  icapacidadpacientes smallint CHECK (icapacidadpacientes > 0),
  bactivo boolean NOT NULL DEFAULT true,
  iid_bodega integer,
  CONSTRAINT tblconsultorios_pkey PRIMARY KEY (iidconsultorio),
  CONSTRAINT fk_consultorio_bodega FOREIGN KEY (iid_bodega) REFERENCES public.tbl_bodegas(iid_bodega)
);
CREATE TABLE public.tblespecialidades (
  iidespecialidad integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tblespecialidades_pkey PRIMARY KEY (iidespecialidad)
);
CREATE TABLE public.tblestadocitas (
  iidestadocita integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  vdescripcion character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tblestadocitas_pkey PRIMARY KEY (iidestadocita)
);
CREATE TABLE public.tblpaises (
  iidpais integer NOT NULL,
  vcodigo character varying NOT NULL,
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT false,
  CONSTRAINT tblpaises_pkey PRIMARY KEY (iidpais)
);
CREATE TABLE public.tblprovincias (
  iidprovincia integer NOT NULL,
  iidpais integer NOT NULL,
  vnombre character varying NOT NULL,
  codprov character varying,
  bactivo boolean DEFAULT true,
  vdescripcion character varying
);
CREATE TABLE public.tipos_area (
  iidtipoarea integer NOT NULL DEFAULT nextval('tipos_area_iidtipoarea_seq'::regclass),
  vnombretipoarea character varying NOT NULL UNIQUE,
  vdescripcion text,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT tipos_area_pkey PRIMARY KEY (iidtipoarea)
);
CREATE TABLE public.ubicaciones (
  iidubicacion integer NOT NULL DEFAULT nextval('ubicaciones_iidubicacion_seq'::regclass),
  vnombreubicacion character varying NOT NULL UNIQUE,
  iidtipoarea integer NOT NULL,
  vcapacidad character varying,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT ubicaciones_pkey PRIMARY KEY (iidubicacion),
  CONSTRAINT ubicaciones_iidtipoarea_fkey FOREIGN KEY (iidtipoarea) REFERENCES public.tipos_area(iidtipoarea)
);
CREATE TABLE public.unidades_medida (
  iidunidad integer NOT NULL DEFAULT nextval('unidades_medida_iidunidad_seq'::regclass),
  vnombreunidad character varying NOT NULL UNIQUE,
  vabreviatura character varying,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT unidades_medida_pkey PRIMARY KEY (iidunidad)
);
CREATE TABLE public.uso_activos (
  iid_uso_activo integer NOT NULL DEFAULT nextval('uso_activos_iid_uso_activo_seq'::regclass),
  vnombre character varying NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  CONSTRAINT uso_activos_pkey PRIMARY KEY (iid_uso_activo)
);
CREATE TABLE public.usuario_roles (
  vusuario character varying NOT NULL,
  iidrol integer NOT NULL,
  bactivo boolean NOT NULL DEFAULT true,
  dfecha_asignacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT usuario_roles_pkey PRIMARY KEY (vusuario, iidrol),
  CONSTRAINT fk_usuario_roles_rol FOREIGN KEY (iidrol) REFERENCES public.roles(iidrol),
  CONSTRAINT fk_usuario_roles_usuario FOREIGN KEY (vusuario) REFERENCES public.segtblusuarios(vusuario)
);
CREATE TABLE public.vadfarmacos (
  codfarmaco integer NOT NULL,
  descripcion character varying NOT NULL,
  bactivo boolean DEFAULT true,
  CONSTRAINT vadfarmacos_pkey PRIMARY KEY (codfarmaco)
);
CREATE TABLE public.vadncomercial (
  codfarmaco integer NOT NULL,
  codpactivo character varying NOT NULL,
  codncomercial character varying NOT NULL,
  descripcion character varying NOT NULL,
  indicacion text,
  posologia character varying,
  contraindicaciones text,
  bactivo boolean DEFAULT true,
  CONSTRAINT vadncomercial_pkey PRIMARY KEY (codncomercial),
  CONSTRAINT vadncomercial_codfarmaco_fkey FOREIGN KEY (codfarmaco) REFERENCES public.vadfarmacos(codfarmaco),
  CONSTRAINT vadncomercial_codpactivo_fkey FOREIGN KEY (codpactivo) REFERENCES public.vadprincactivo(codpactivo)
);
CREATE TABLE public.vadprincactivo (
  codfarmaco integer NOT NULL,
  codpactivo character varying NOT NULL,
  descripcion character varying NOT NULL,
  caracteristica text,
  bactivo boolean DEFAULT true,
  CONSTRAINT vadprincactivo_pkey PRIMARY KEY (codpactivo),
  CONSTRAINT vadprincactivo_codfarmaco_fkey FOREIGN KEY (codfarmaco) REFERENCES public.vadfarmacos(codfarmaco)
);
