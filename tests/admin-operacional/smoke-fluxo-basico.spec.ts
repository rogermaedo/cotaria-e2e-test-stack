import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const apiBaseUrl = process.env.E2E_API_URL;

test.describe('Admin Operacional - Fluxo Básico', () => {
  test('login, criação de participante, grupo e cota', async ({ page, request }) => {
    if (!adminEmail || !adminPassword) {
      test.skip(true, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD no ambiente antes de executar os testes.');
      return;
    }

    const uniqueSuffix = randomUUID().slice(0, 8);
    const participanteNome = `Participante QA ${uniqueSuffix}`;
    const participanteEmail = `participante.qa.${uniqueSuffix}@example.com`;
    const participanteCpf = gerarCpfFormatado();
    const telefone = gerarTelefone();
    const grupoNome = `Grupo QA ${uniqueSuffix}`;
    const grupoDescricao = `Grupo criado via Playwright ${uniqueSuffix}`;
    const contaBancariaNome = `Titular QA ${uniqueSuffix}`;
    const bancoNome = 'Playwright Bank';
    const agenciaNumero = '1234';
    const contaNumero = '567890';

    await page.route('**/participantes**', async (route) => {
      const requestUrl = route.request().url();
      const method = route.request().method();
      if (method !== 'GET') {
        await route.continue();
        return;
      }

      const url = new URL(requestUrl);
      if (!url.searchParams.has('limit')) {
        url.searchParams.set('limit', '1000');
      }
      if (!url.searchParams.has('page')) {
        url.searchParams.set('page', '1');
      }
      await route.continue({ url: url.toString() });
    });

    await test.step('realizar login', async () => {
      await page.goto('/login');
      await page.getByLabel('E-mail').fill(adminEmail!);
      await page.getByLabel('Senha').fill(adminPassword!);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL('**/dashboard', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    await test.step('criar participante', async () => {
      await page.getByRole('link', { name: 'Participantes' }).click();
      await page.waitForURL('**/participantes', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Participantes', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Novo Participante' }).click();
      await page.waitForURL('**/participantes/novo', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Novo Participante' })).toBeVisible();

      await page.getByLabel('Nome Completo *').fill(participanteNome);
      await page.getByLabel('Email *').fill(participanteEmail);
      await page.getByLabel(/CPF|CNPJ \*/).fill(participanteCpf);
      await page.getByLabel('Telefone').fill(telefone);
      await page.getByLabel(/Endereço/).fill('Rua Playwright, 123 - São Paulo/SP');
      await page.getByRole('button', { name: 'Criar Participante' }).click();
      await expect(page.getByText('Participante criado com sucesso!')).toBeVisible();
      await page.waitForURL('**/participantes', { waitUntil: 'networkidle' });
    });

    let grupoId: number | undefined;
    let authToken: string | null = null;
    let cotaId: number | undefined;
    let cotaNumero: number | undefined;

    await test.step('criar grupo', async () => {
      await page.getByRole('link', { name: 'Grupos' }).click();
      await page.waitForURL('**/grupos', { waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: 'Novo Grupo' })).toBeVisible();

      await page.getByRole('button', { name: 'Novo Grupo' }).click();
      await page.waitForURL('**/grupos/novo', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Criar Novo Grupo' })).toBeVisible();

      await page.getByLabel('Nome do Grupo *').fill(grupoNome);
      await page.getByLabel('Descrição do Grupo *').fill(grupoDescricao);
      await page.getByLabel('Banco *').fill(bancoNome);
      await page.getByLabel('Agência *').fill(agenciaNumero);
      await page.getByRole('textbox', { name: 'Conta *' }).fill(contaNumero);
      await page.getByLabel('Nome do Titular *').fill(contaBancariaNome);
      await page.getByRole('button', { name: 'Criar Grupo' }).click();
      await expect(page.getByText('Grupo criado com sucesso!')).toBeVisible();
      await page.waitForURL('**/grupos', { waitUntil: 'networkidle' });

      authToken = await page.evaluate(() => localStorage.getItem('access_token'));
      if (!authToken) {
        throw new Error('Token de autenticação não encontrado após login.');
      }

      const response = await request.get(`${apiBaseUrl}/grupos?status=EM_OPERACAO&limit=50&page=1`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      const grupoEncontrado = body?.data?.find((g: { nome: string }) => g.nome === grupoNome);
      expect(grupoEncontrado, 'Grupo recém-criado não encontrado na API').toBeTruthy();
      grupoId = grupoEncontrado.id;

      const statusResponse = await request.put(`${apiBaseUrl}/grupos/${grupoId}/status`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          grupoId,
          status: 'ATIVO_DISPONIVEL',
        },
      });
      expect(statusResponse.ok()).toBeTruthy();
    });

    await test.step('criar cota vinculada', async () => {
      if (!grupoId || !authToken) {
        throw new Error('Grupo não está disponível para criação de cota.');
      }

      await page.getByRole('link', { name: 'Cotas' }).click();
      await page.waitForURL('**/cotas', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Gestão de Cotas' })).toBeVisible();

      await page.getByRole('button', { name: 'Nova Cota' }).click();
      await page.waitForURL('**/cotas/nova', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: /Nova Cota/i })).toBeVisible();

      await page.getByRole('combobox', { name: 'Grupo de Consórcio *' }).click();
      await page.getByRole('option', { name: new RegExp(grupoNome) }).click();

      await page.getByRole('button', { name: 'Selecionar' }).click();
      await page.getByPlaceholder('Buscar por nome, CPF/CNPJ ou email...').fill(participanteNome);
      const linhaParticipante = page.getByRole('row', { name: new RegExp(participanteNome) });
      await expect(linhaParticipante).toBeVisible({ timeout: 10_000 });
      await linhaParticipante.getByRole('button', { name: 'Selecionar' }).click();
      await expect(page.getByRole('button', { name: 'Remover participante' })).toBeVisible();

      await page.fill('#valorCartaCredito', '8000000'); // R$ 80.000,00
      await page.fill('#percentualTaxaAdministracao', '10');
      await page.fill('#quantidadeParcelas', '120');
      await page.fill('#diaVencimento', '10');

      await page.getByRole('button', { name: 'Criar Cota' }).click();
      await expect(page.getByText('Cota criada com sucesso!')).toBeVisible();
      await page.waitForURL('**/cotas*', { waitUntil: 'networkidle' });
    });

    await test.step('registrar identificadores da cota criada', async () => {
      if (!grupoId || !authToken) {
        throw new Error('Grupo ou token não disponíveis para localizar a cota.');
      }

      const cotasGrupoResponse = await request.get(`${apiBaseUrl}/cotas/grupo/${grupoId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(cotasGrupoResponse.ok()).toBeTruthy();
      const cotasGrupo = await cotasGrupoResponse.json();
      const cotaRecemCriada = cotasGrupo.find((c: any) => c.participante?.nome === participanteNome);
      expect(cotaRecemCriada, 'Cota recém-criada não encontrada via API').toBeTruthy();
      cotaId = Number(cotaRecemCriada?.id ?? cotaRecemCriada?.cotaId);
      expect(cotaId && Number.isFinite(cotaId)).toBeTruthy();
      cotaNumero = Number(cotaRecemCriada?.numero ?? 0);
      expect(cotaRecemCriada.status).toBe('PENDENTE');
    });

    await test.step('pagar primeira parcela e ativar cota', async () => {
      if (!cotaId || !authToken) {
        throw new Error('Cota ou token não disponíveis para pagamento.');
      }

      const parcelasResponse = await request.get(`${apiBaseUrl}/cotas/${cotaId}/parcelas?page=1&limit=10`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(parcelasResponse.ok()).toBeTruthy();
      const parcelasPayload = await parcelasResponse.json();
      const primeiraParcela = parcelasPayload?.data?.find((p: any) => p.numeroParcela === 1) ?? parcelasPayload?.data?.[0];
      expect(primeiraParcela, 'Primeira parcela não encontrada').toBeTruthy();

      const pagarResponse = await request.patch(`${apiBaseUrl}/parcelas/${primeiraParcela.id}/pagar`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        data: {},
      });
      expect(pagarResponse.ok()).toBeTruthy();

      let cotaAtiva = false;
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const cotaResponse = await request.get(`${apiBaseUrl}/cotas/${cotaId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        expect(cotaResponse.ok()).toBeTruthy();
        const cotaJson = await cotaResponse.json();
        if (cotaJson.status === 'ATIVA_ADIMPLENTE_NAO_CONTEMPLADA') {
          cotaAtiva = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!cotaAtiva) {
        test.fail(true, 'Cota não ficou ativa após pagamento da primeira parcela');
        return;
      }

      await page.waitForTimeout(1000);
      const parcelaVerificadaResponse = await request.get(
        `${apiBaseUrl}/cotas/${cotaId}/parcelas?page=1&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      expect(parcelaVerificadaResponse.ok()).toBeTruthy();
      const parcelasVerificadas = await parcelaVerificadaResponse.json();
      const primeiraParcelaAtualizada =
        parcelasVerificadas?.data?.find((p: any) => p.numeroParcela === 1) ??
        parcelasVerificadas?.data?.[0];
      expect(primeiraParcelaAtualizada?.status).toBe('PAGO');
    });

    await test.step('agendar assembleia de abertura', async () => {
      if (!grupoId) {
        throw new Error('Grupo não definido para criação da assembleia.');
      }

      await page.getByRole('link', { name: 'Assembleias' }).click();
      await page.waitForURL('**/assembleias', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Agendar Assembleia' }).click();
      await page.waitForURL('**/assembleias/nova', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: /Agendar Nova Assembleia|Nova Assembleia para Grupo/ })).toBeVisible();

      await page.getByRole('combobox', { name: 'Grupo de Consórcio *' }).click();
      await page.getByRole('option', { name: new RegExp(grupoNome) }).click();

      const hoje = new Date().toISOString().slice(0, 10);
      await page.getByLabel('Data da Assembleia *').fill(hoje);

      await page.getByRole('combobox', { name: 'Tipo de Assembleia *' }).click();
      const opcaoAbertura = page.getByRole('option', { name: 'Assembleia de Abertura' });
      await expect(opcaoAbertura).toBeVisible({ timeout: 5000 });
      await opcaoAbertura.click();

      await page.getByLabel('Descrição da Assembleia').fill(`Assembleia de abertura Playwright ${uniqueSuffix}`);

      await page.getByRole('button', { name: 'Agendar Assembleia' }).click();
      await expect(page.getByText('Assembleia agendada com sucesso!')).toBeVisible();
      await page.waitForURL('**/assembleias', { waitUntil: 'networkidle' });
      const cardAssembleia = page
        .locator('div')
        .filter({ hasText: grupoNome })
        .filter({ hasText: `Assembleia de abertura Playwright ${uniqueSuffix}` })
        .first();
      await expect(cardAssembleia).toBeVisible();
      await expect(cardAssembleia).toContainText('Abertura');
    });
  });
});

function gerarCpfFormatado(): string {
  const digits = Math.floor(Math.random() * 1e11).toString().padStart(11, '0');
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function gerarTelefone(): string {
  const digits = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  return `(11) 9${digits.slice(0, 4)}-${digits.slice(4)}`;
}


