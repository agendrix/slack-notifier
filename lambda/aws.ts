import AWS, { CodePipeline } from "aws-sdk";
import { S3_CONFIG } from "./env";

const S3_OBJECT = { Bucket: S3_CONFIG.bucket, Key: `${S3_CONFIG.key}/pipelines.json` };

export async function loadData(): Promise<WorkflowData> {
  const s3 = new AWS.S3();

  try {
    const response = await s3.getObject(S3_OBJECT).promise();

    return JSON.parse(response.Body?.toString() || "{}");
  } catch (error) {
    if (error.code === "NoSuchKey") return {};
    throw error;
  }
}

export async function saveData(items: WorkflowData): Promise<void> {
  const s3 = new AWS.S3();
  await s3.upload({ ...S3_OBJECT, Body: JSON.stringify(items) }).promise();
}

export async function saveItem(executionId: string, data: WorkflowItem): Promise<void> {
  const items = await loadData();
  items[executionId] = data;
  await saveData(items);
}

export async function removeItem(executionId: string): Promise<void> {
  const items = await loadData();
  delete items[executionId];
  await saveData(items);
}

export async function getPipelineCommitSha(event: CodePipelineEvent): Promise<string | undefined> {
  const codePipeline = new AWS.CodePipeline();

  try {
    const params: CodePipeline.Types.GetPipelineExecutionInput = {
      pipelineExecutionId: event.detail["execution-id"],
      pipelineName: event.detail.pipeline,
    };
    const response = await codePipeline.getPipelineExecution(params).promise();

    return response.pipelineExecution?.artifactRevisions?.[0]?.revisionId;
  } catch (error) {
    if (error.errorType === "PipelineExecutionNotFoundException") {
      await removeItem(event.detail["execution-id"]);
    }
    throw error;
  }
}

export async function getLatestDeployedCommitShaFromECR(ecrRefRepository: string): Promise<string | undefined> {
  const ecr = new AWS.ECR();
  const response = await ecr
    .listImages({
      repositoryName: ecrRefRepository,
    })
    .promise();

  const images = response.imageIds;
  if (!images || images.length === 0) {
    return undefined;
  } else {
    const latestImage = images.find(e => e.imageTag === "latest");
    if (!latestImage) return undefined;

    const latestImageWithCommitTag = images.find(
      e => e.imageDigest === latestImage.imageDigest && e.imageTag !== "latest"
    );

    if (!latestImageWithCommitTag) return undefined;
    return latestImageWithCommitTag.imageTag;
  }
}

export async function listPipelineActionExecutions(
  pipelineName: string,
  pipelineExecutionId: string
): Promise<CodePipeline.ActionExecutionDetailList> {
  const codePipeline = new AWS.CodePipeline();

  try {
    const response = await codePipeline
      .listActionExecutions({
        pipelineName,
        filter: { pipelineExecutionId },
      })
      .promise();
    return response.actionExecutionDetails || [];
  } catch (error) {
    if (error.errorType === "PipelineExecutionNotFoundException") {
      await removeItem(pipelineExecutionId);
    }
    return [];
  }
}

export function getPipelineState(pipelineName: string): Promise<CodePipeline.GetPipelineStateOutput> {
  const codePipeline = new AWS.CodePipeline();
  return codePipeline.getPipelineState({ name: pipelineName }).promise();
}

export async function findPipelineExecutionId(
  pipelineName: string,
  pipelines: WorkflowData,
  codeDeployExecutionId: string
): Promise<string | undefined> {
  console.log("Searching Pipeline ExecutionId...");
  for (const pipeline of Object.values(pipelines)) {
    const actionExecutions = await listPipelineActionExecutions(pipelineName, pipeline.executionId);
    console.log("codeDeployExecutionId", codeDeployExecutionId);

    if (JSON.stringify(actionExecutions).includes(codeDeployExecutionId)) {
      console.log("Found in actions");
      return pipeline.executionId;
    }
  }

  // If the codeDeployExecutionId is not found in the actionExecutions history,
  // we must search the current execution.
  const currentPipelineState = await getPipelineState(pipelineName);
  const stageStates: CodePipeline.StageStateList = currentPipelineState.stageStates || [];
  for (const stage of stageStates) {
    if (!stage.latestExecution || !stage.actionStates) continue;

    for (const action of stage.actionStates) {
      if (action.latestExecution && action.latestExecution.externalExecutionId === codeDeployExecutionId) {
        console.log("Found in current pipeline");
        return stage.latestExecution.pipelineExecutionId;
      }
    }
  }

  console.log("Not found");
  return undefined;
}
