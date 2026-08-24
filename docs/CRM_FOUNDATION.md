# CRM multiempresa — frontera IA y atención humana

## Regla de autoridad

El funnel automático y el CRM comercial son dos zonas distintas:

1. **Autoridad `AI`**: el agente solo puede avanzar por `AI_NEW → AI_QUALIFYING → AI_QUALIFIED → AI_CALL_REQUESTED`.
2. **Toma explícita**: un usuario autenticado ejecuta `crm_take_human_lead`; la base guarda quién y cuándo tomó el lead.
3. **Autoridad `HUMAN`**: recién entonces se habilitan movimientos, notas y tareas comerciales.
4. **Bloqueo duro**: `crm_agent_move_lead` rechaza cualquier intento de la IA cuando la autoridad es humana.
5. **Devolución explícita**: solo `crm_return_lead_to_ai`, con motivo, puede devolver un lead no cerrado.
6. **Cierres terminales**: `WON`, `LOST` y `DO_NOT_CONTACT` no vuelven al funnel silenciosamente.

La interfaz nunca es la autoridad final. Todas estas reglas están duplicadas como restricciones y funciones transaccionales en PostgreSQL.

## Modelo

- `crm_organizations`: empresas clientes.
- `crm_organization_members`: usuarios, roles y acceso por empresa.
- `crm_contacts`: identidad del contacto, separada del negocio.
- `crm_leads`: autoridad, etapa, responsable, prioridad y estado comercial.
- `crm_activities`: bitácora append-only de cambios.
- `crm_notes`: notas humanas, prohibidas durante la autoridad de IA.
- `crm_tasks`: tareas humanas, prohibidas durante la autoridad de IA.

## Seguridad

- Las tablas CRM no conceden ningún acceso a `anon`.
- `authenticated` solo obtiene filas de sus organizaciones mediante RLS.
- Los leads no permiten actualizaciones directas desde el navegador; se modifican mediante RPC verificadas.
- La transición de IA queda reservada a `service_role`, únicamente del lado servidor/n8n.
- El modelo no modifica las tablas históricas existentes durante la preparación.

## Despliegue seguro

1. Aplicar la migración en un entorno de prueba.
2. Crear una organización y asociar el usuario dueño.
3. La migración `202608240002_crm_sync_legacy_proyecta.sql` importa de forma idempotente solo
   solicitudes de llamada y tomas humanas explícitas desde `clientes agente test`, conservando
   `legacy_table` y `legacy_id`. Un trigger posterior mantiene esa copia actualizada sin bloquear n8n.
4. Las solicitudes de llamada entran como `AI_CALL_REQUESTED`; solo una toma explícita entra con
   autoridad `HUMAN`. Una sincronización posterior nunca rebaja un lead que ya pertenece a una persona.
5. Conectar n8n con `service_role` mediante una credencial protegida.
6. Tras aplicar y verificar la migración, el CRM queda activo por defecto. `CRM_ENABLED=false` y
   `NEXT_PUBLIC_CRM_ENABLED=false` funcionan como apagado operativo explícito.
7. Mantener las tablas anteriores operativas hasta verificar el corte.
