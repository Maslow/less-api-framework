import { Test, TestingModule } from '@nestjs/testing'
import { ResourceLabels } from '../constants'
import { KubernetesService } from './kubernetes.service'

let service: KubernetesService

beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [KubernetesService],
  }).compile()

  service = module.get<KubernetesService>(KubernetesService)
})

describe('KubernetesService::apply() & delete()', () => {
  const name = 'test-for-apply'
  const spec = `
apiVersion: v1
kind: Namespace
metadata:
  name: ${name}
  `

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should be able to apply a spec', async () => {
    await service.applyYamlString(spec)
    const exists = await service.existsNamespace(name)
    expect(exists).toBeTruthy()
  })

  jest.setTimeout(20000)

  it('should be able to delete a spec', async () => {
    await service.deleteYamlString(spec)
    // wait for 10s
    await new Promise((resolve) => setTimeout(resolve, 10000))
    const exists = await service.existsNamespace(name)
    expect(exists).toBeFalsy()
  })

  afterAll(async () => {
    await service.deleteYamlString(spec)
  })
})

describe('KubernetesService::createNamespace()', () => {
  const name = 'test-for-create-namespace'

  beforeAll(async () => {
    if (await service.existsNamespace(name)) {
      await service.deleteNamespace(name)
    }
  })

  it('should be able to create namespace', async () => {
    await service.createNamespace(name)

    expect(await service.existsNamespace(name)).toBeTruthy()

    await service.deleteNamespace(name)
  })

  afterAll(async () => {
    if (await service.existsNamespace(name)) {
      await service.deleteNamespace(name)
    }
  })
})

describe.skip('list custom objects with label', () => {
  it('should be able to list custom objects with label', async () => {
    const userid = 'test-user-id'
    const res = await service.customObjectApi.listClusterCustomObject(
      'application.laf.dev',
      'v1',
      'applications',
      undefined,
      undefined,
      undefined,
      undefined,
      `${ResourceLabels.USER_ID}=${userid}`,
    )
    console.log(res.body)
  })
})
