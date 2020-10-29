import { MockCodePipeline, MockECR, MockS3 } from "./aws-sdk";
import assert from "assert";
import AWS from "aws-sdk";

describe("Mock aws-sdk", () => {
  it("mock CodePipeline", async () => {
    const codePipeline = new AWS.CodePipeline();
    const mockCodePipeline = new MockCodePipeline();

    assert.deepStrictEqual(
      await codePipeline.getPipelineExecution().promise(),
      await mockCodePipeline.getPipelineExecution().promise()
    );
    assert.deepStrictEqual(
      await codePipeline.getPipelineState({ name: "" }).promise(),
      await mockCodePipeline.getPipelineState({ name: "" }).promise()
    );
  });

  it("mock ECR", async () => {
    const ecr = new AWS.ECR();
    const mockECR = new MockECR();

    assert.deepStrictEqual(
      await ecr.listImages({ repositoryName: "" }).promise(),
      await mockECR.listImages({ repositoryName: "" }).promise()
    );
  });

  describe("mock s3", () => {
    it("mock functions", async () => {
      const s3 = new AWS.S3();
      const mockS3 = new MockS3();

      assert.deepStrictEqual(
        await s3.getObject({ Bucket: "Test1", Key: "Key1" }).promise(),
        await mockS3.getObject({ Bucket: "Test1", Key: "Key1" }).promise()
      );
      assert.deepStrictEqual(
        await s3.upload({ Bucket: "Test1", Key: "Key1", Body: "TestBody1" }).promise(),
        await mockS3.upload({ Bucket: "Test1", Key: "Key1", Body: "TestBody1" }).promise()
      );
    });

    it("can save data", async () => {
      const s3 = new AWS.S3();

      await s3.upload({ Bucket: "Test1", Key: "Key1", Body: "TestBody1" }).promise();
      await s3.upload({ Bucket: "Test2", Key: "Key2", Body: "TestBody2" }).promise();

      const data1 = await s3.getObject({ Bucket: "Test1", Key: "Key1" }).promise();
      const data2 = await s3.getObject({ Bucket: "Test2", Key: "Key2" }).promise();

      assert.equal(data1.Body, "TestBody1");
      assert.equal(data2.Body, "TestBody2");
    });
  });
});
