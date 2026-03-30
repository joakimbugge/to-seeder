import { ConsoleLogger, type ModuleMetadata } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

export async function compileModule(metadata: ModuleMetadata): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule(metadata).compile();
  moduleRef.useLogger(new ConsoleLogger());
  return moduleRef;
}
