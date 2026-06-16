import type { FastifyInstance } from 'fastify';
import type { ClinicorpClient } from '../../integrations/clinicorp/types';

export interface CatalogoDeps {
  clinicorp: ClinicorpClient;
}

export function registerCatalogoRoutes(app: FastifyInstance, deps: CatalogoDeps): void {
  app.get('/pacientes/aniversariantes', async (_req, reply) => {
    const aniversariantes = await deps.clinicorp.listBirthdays();
    return reply.status(200).send({ aniversariantes });
  });

  app.get('/catalogo/especialidades', async (_req, reply) => {
    const especialidades = await deps.clinicorp.listSpecialties();
    return reply.status(200).send({ especialidades });
  });

  app.get('/catalogo/profissionais', async (_req, reply) => {
    const profissionais = await deps.clinicorp.listProfessionals();
    return reply.status(200).send({ profissionais });
  });
}
