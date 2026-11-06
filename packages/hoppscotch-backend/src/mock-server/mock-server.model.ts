import {
  Field,
  ID,
  Int,
  ObjectType,
  ArgsType,
  InputType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OffsetPaginationArgs } from 'src/types/input-types.args';
import { WorkspaceType } from 'src/types/WorkspaceTypes';

// Regex pattern for mock server name validation
// Allows letters, numbers, spaces, dots, brackets, underscores, and hyphens
const MOCK_SERVER_NAME_PATTERN = /^[a-zA-Z0-9 .()[\]{}<>_-]+$/;
const MOCK_SERVER_NAME_ERROR_MESSAGE =
  'Name can only contain letters, numbers, spaces, dots, brackets, underscores, and hyphens';

@ObjectType()
export class MockServer {
  @Field(() => ID, {
    description: 'ID of the mock server',
  })
  id: string;

  @Field({
    description: 'Name of the mock server',
  })
  name: string;

  @Field({
    description: 'Subdomain for the mock server (e.g., mock-1234)',
  })
  subdomain: string;

  @Field({
    nullable: true,
    description:
      'Server URL for the mock server using subdomain pattern (e.g., https://1234.mock.backend-hoppscotch.io)',
  })
  serverUrlDomainBased: string;

  @Field({
    description:
      'Server URL for the mock server using path pattern (e.g., https://backend.hoppscotch.io/mock/1234)',
  })
  serverUrlPathBased: string;

  @Field(() => WorkspaceType, {
    description: 'Type of workspace: USER or TEAM',
  })
  workspaceType: WorkspaceType;

  @Field({
    nullable: true,
    description:
      'ID of the workspace (user or team) to associate with the mock server',
  })
  workspaceID?: string;

  @Field({
    description: 'Delay in milliseconds before responding',
  })
  delayInMs: number;

  @Field({
    description: 'Whether the mock server is active',
  })
  isActive: boolean;

  @Field({
    description: 'Whether the mock server is publicly accessible',
  })
  isPublic: boolean;

  @Field(() => Int, {
    description: 'Total number of requests served by the mock server',
  })
  hitCount: number;

  @Field(() => Int, {
    description:
      'Total number of requests that resulted in a response status of 400 or above. For mock servers created before error tracking, errors from request logs deleted before then are not included.',
  })
  errorCount: number;

  @Field({
    nullable: true,
    description: 'Date and time when the mock server last served a request',
  })
  lastHitAt?: Date;

  @Field({
    description: 'Date and time when the mock server was created',
  })
  createdOn: Date;

  @Field({
    description: 'Date and time when the mock server was last updated',
  })
  updatedOn: Date;
}

@ObjectType()
export class MockServerCollection {
  @Field(() => ID, {
    description: 'ID of the collection',
  })
  id: string;

  @Field({
    description: 'Title of the collection',
  })
  title: string;
}

@InputType()
export class CreateMockServerInput {
  @Field({
    description: 'Name of the mock server',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(MOCK_SERVER_NAME_PATTERN, {
    message: MOCK_SERVER_NAME_ERROR_MESSAGE,
  })
  name: string;

  @IsString()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'ID of the (team or user) collection to associate with the mock server',
  })
  collectionID?: string;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'Whether to auto-create a collection for the mock server if collectionID is not provided',
  })
  autoCreateCollection?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'Whether to auto-create request examples in the collection for the mock server',
  })
  autoCreateRequestExample?: boolean;

  @IsEnum(WorkspaceType)
  @Field(() => WorkspaceType, {
    description: 'Type of workspace: USER or TEAM',
  })
  workspaceType: WorkspaceType;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description:
      'ID of the workspace (user or team) to associate with the mock server',
  })
  workspaceID?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(60000)
  @Field({
    nullable: true,
    defaultValue: 0,
    description: 'Delay in milliseconds before responding',
  })
  delayInMs?: number;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'Whether the mock server is publicly accessible (defaults to false/private if omitted)',
  })
  isPublic?: boolean;
}

@InputType()
export class UpdateMockServerInput {
  @Field({
    nullable: true,
    description: 'Name of the mock server',
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  @Matches(MOCK_SERVER_NAME_PATTERN, {
    message: MOCK_SERVER_NAME_ERROR_MESSAGE,
  })
  name?: string;

  @Field({
    nullable: true,
    description: 'Delay in milliseconds before responding',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60000)
  delayInMs?: number;

  @Field({
    nullable: true,
    description: 'Whether the mock server is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({
    nullable: true,
    description: 'Whether the mock server is publicly accessible',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

@ObjectType()
export class MockServerResponse {
  @Field({
    description: 'HTTP status code to return',
  })
  statusCode: number;

  @Field({
    nullable: true,
    description: 'Response body to return',
  })
  body?: string;

  @Field({
    nullable: true,
    description: 'Response headers as JSON string',
  })
  headers?: string;

  @Field({
    defaultValue: 0,
    description: 'Delay in milliseconds before response',
  })
  delay: number;
}

@ArgsType()
export class MockServerMutationArgs {
  @Field(() => ID, {
    description: 'ID of the mock server',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}

@ArgsType()
export class FetchTeamMockServersArgs extends OffsetPaginationArgs {
  @Field(() => ID, {
    name: 'teamID',
    description: 'Id of the team to add to',
  })
  @IsString()
  @IsNotEmpty()
  teamID: string;
}

@ObjectType()
export class MockServerLog {
  @Field(() => ID, {
    description: 'ID of the log entry',
  })
  id: string;

  @Field(() => ID, {
    description: 'ID of the mock server',
  })
  mockServerID: string;

  @Field({
    description: 'HTTP method of the request',
  })
  requestMethod: string;

  @Field({
    description: 'Path of the request',
  })
  requestPath: string;

  @Field({
    description: 'Request headers as JSON string',
  })
  requestHeaders: string;

  @Field({
    nullable: true,
    description: 'Request body as JSON string',
  })
  requestBody?: string;

  @Field({
    nullable: true,
    description: 'Request query parameters as JSON string',
  })
  requestQuery?: string;

  @Field({
    description: 'HTTP status code of the response',
  })
  responseStatus: number;

  @Field({
    description: 'Response headers as JSON string',
  })
  responseHeaders: string;

  @Field({
    nullable: true,
    description: 'Response body as JSON string',
  })
  responseBody?: string;

  @Field({
    description: 'Response time in milliseconds',
  })
  responseTime: number;

  @Field({
    nullable: true,
    description: 'IP address of the requester',
  })
  ipAddress?: string;

  @Field({
    nullable: true,
    description: 'User agent of the requester',
  })
  userAgent?: string;

  @Field({
    description: 'Date and time when the request was executed',
  })
  executedAt: Date;
}

export const MOCK_SERVER_STATS_DEFAULT_DAYS = 30;
export const MOCK_SERVER_STATS_MAX_DAYS = 90;

@ArgsType()
export class MockServerStatsArgs {
  @Field(() => ID, {
    description: 'ID of the mock server',
  })
  @IsString()
  @IsNotEmpty()
  mockServerID: string;

  @Field(() => Int, {
    nullable: true,
    defaultValue: MOCK_SERVER_STATS_DEFAULT_DAYS,
    description: `Number of days (including today, in UTC) to return stats for. Maximum ${MOCK_SERVER_STATS_MAX_DAYS}`,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MOCK_SERVER_STATS_MAX_DAYS)
  @Type(() => Number)
  days: number = MOCK_SERVER_STATS_DEFAULT_DAYS;
}

@ObjectType()
export class MockServerDailyStat {
  @Field({
    description: 'UTC day the counters belong to, formatted as YYYY-MM-DD',
  })
  date: string;

  @Field(() => Int, {
    description: 'Number of requests served on this day',
  })
  hitCount: number;

  @Field(() => Int, {
    description:
      'Number of requests on this day that resulted in a response status of 400 or above',
  })
  errorCount: number;

  @Field(() => Int, {
    description:
      'Average response time in milliseconds for this day, 0 when there were no requests',
  })
  avgResponseTimeMs: number;
}

@ObjectType()
export class MockServerStats {
  @Field(() => ID, {
    description: 'ID of the mock server',
  })
  mockServerID: string;

  @Field(() => Int, {
    description: 'Number of requests served within the requested window',
  })
  hitCount: number;

  @Field(() => Int, {
    description:
      'Number of requests within the requested window that resulted in a response status of 400 or above',
  })
  errorCount: number;

  @Field(() => Int, {
    description:
      'Average response time in milliseconds within the requested window, 0 when there were no requests',
  })
  avgResponseTimeMs: number;

  @Field(() => [MockServerDailyStat], {
    description:
      'Per-day counters ordered from oldest to newest, with days without traffic included as zeroes',
  })
  daily: MockServerDailyStat[];
}

registerEnumType(WorkspaceType, {
  name: 'WorkspaceType',
});
