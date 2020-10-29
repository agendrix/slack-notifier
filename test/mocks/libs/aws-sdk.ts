import AWS, { CodePipeline, ECR, S3 } from "aws-sdk";
import { mock } from "./constants";
import codeDeployInstanceSuccess from "../events/codeDeployInstanceSuccess.json";

type PromiseResult<T> = { promise: () => Promise<T> };

export class MockCodePipeline {
  getPipelineExecution(): PromiseResult<CodePipeline.GetPipelineExecutionOutput> {
    return {
      promise: async () => ({
        pipelineExecution: undefined
      })
    };
  }
  getPipelineState(params: CodePipeline.GetPipelineStateInput): PromiseResult<CodePipeline.GetPipelineStateOutput> {
    return {
      promise: async () => ({
        pipelineName: params.name,
        stageStates: undefined
      })
    };
  }
  listActionExecutions(
    _params: CodePipeline.ListActionExecutionsInput
  ): PromiseResult<CodePipeline.ListActionExecutionsOutput> {
    return {
      promise: async () => ({
        actionExecutionDetails: [{ actionExecutionId: codeDeployInstanceSuccess.detail.deploymentId }]
      })
    };
  }
}
AWS.CodePipeline = MockCodePipeline as any;

export class MockECR {
  listImages(_params: ECR.ListImagesRequest): PromiseResult<ECR.ListImagesResponse> {
    return {
      promise: async () => ({
        imageIds: [{ imageTag: "latest", imageDigest: mock.commits.base.ref }]
      })
    };
  }
}
AWS.ECR = MockECR as any;

const mockedS3Buckets = {};
export class MockS3 {
  getObject(params: S3.Types.GetObjectRequest): PromiseResult<S3.GetObjectOutput> {
    return {
      promise: async () => ({
        Body: mockedS3Buckets[`${params.Bucket}-${params.Key}`]
      })
    };
  }
  upload(params: S3.Types.PutObjectRequest): PromiseResult<S3.ManagedUpload.SendData> {
    return {
      promise: async () => {
        mockedS3Buckets[`${params.Bucket}-${params.Key}`] = params.Body as string;
        return {
          Bucket: params.Bucket,
          Key: params.Key,
          ETag: "",
          Location: ""
        };
      }
    };
  }
}
AWS.S3 = MockS3 as any;
