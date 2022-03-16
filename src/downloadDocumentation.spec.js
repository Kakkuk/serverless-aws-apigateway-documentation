describe('ServerlessAWSDocumentation', function () {
  let objectUnderTest;

  beforeEach(() => {
    jest.resetModules()
    objectUnderTest = require('./downloadDocumentation.js');
    objectUnderTest.fs = {
      writeFileSync: jest.fn()
    };
    objectUnderTest.serverless = {
      providers: {
        aws: {
          naming: {
            getStackName: () => {
              return 'testStackName';
            }
          },
          request: jest.fn(),
          getStage: () => 'testStage',
          getRegion: () => 'testRegion'
        }
      },
      service: {
        provider: {
          stage: 'testStage',
          region: 'testRegion',
        }
      }
    };
  });

  afterEach(() => {
    delete require.cache[require.resolve('./downloadDocumentation.js')];
  });

  describe('downloadDocumentation', () => {
    it('should successfully download documentation, unknown file extension', async () => {
      objectUnderTest.options = {
        outputFileName: 'test.txt',
      };
      objectUnderTest._getRestApiId = () => {
        return Promise.resolve('testRestApiId')
      };

      objectUnderTest.serverless.providers.aws.request.mockReturnValue(Promise.resolve({
        body: 'some body',
      }));
      await objectUnderTest.downloadDocumentation().then(() => {
        expect(objectUnderTest.serverless.providers.aws.request).toHaveBeenCalledWith('APIGateway', 'getExport', {
          stageName: 'testStage',
          restApiId: 'testRestApiId',
          exportType: 'swagger',
          parameters: {
            extensions: 'integrations',
          },
          accepts: 'application/json',
        });
        expect(objectUnderTest.fs.writeFileSync).toHaveBeenCalledWith('test.txt', 'some body');
      });
    });

    it('should successfully download documentation, yaml extension', async () => {
      objectUnderTest.options = {
        outputFileName: 'test.yml',
      };
      objectUnderTest._getRestApiId = () => {
        return Promise.resolve('testRestApiId')
      };

      objectUnderTest.serverless.providers.aws.request.mockReturnValue(Promise.resolve({
        body: 'some body',
      }));
      await objectUnderTest.downloadDocumentation().then(() => {
        expect(objectUnderTest.serverless.providers.aws.request).toHaveBeenCalledWith('APIGateway', 'getExport', {
          stageName: 'testStage',
          restApiId: 'testRestApiId',
          exportType: 'swagger',
          parameters: {
            extensions: 'integrations',
          },
          accepts: 'application/yaml',
        });
        expect(objectUnderTest.fs.writeFileSync).toHaveBeenCalledWith('test.yml', 'some body');
      });
    });

    it('should successfully download documentation, yaml extension, using an extensions argument', async () => {
      objectUnderTest.options = {
        outputFileName: 'test.yml',
        extensions: 'apigateway',
      };
      objectUnderTest._getRestApiId = () => {
        return Promise.resolve('testRestApiId')
      };

      objectUnderTest.serverless.providers.aws.request.mockReturnValue(Promise.resolve({
        body: 'some body',
      }));
      await objectUnderTest.downloadDocumentation().then(() => {
        expect(objectUnderTest.serverless.providers.aws.request).toHaveBeenCalledWith('APIGateway', 'getExport', {
          stageName: 'testStage',
          restApiId: 'testRestApiId',
          exportType: 'swagger',
          parameters: {
            extensions: 'apigateway',
          },
          accepts: 'application/yaml',
        });
        expect(objectUnderTest.fs.writeFileSync).toHaveBeenCalledWith('test.yml', 'some body');
      });
    });

    it('should throw an error', () => {
      objectUnderTest.options = {
        outputFileName: 'test.json',
      };
      objectUnderTest._getRestApiId = () => {
        return Promise.resolve('testRestApiId');
      };
      objectUnderTest.serverless.providers.aws.request.mockReturnValue(Promise.reject('reason'));
      return objectUnderTest.downloadDocumentation().catch(() => {});
    });

    it('should get rest api id', () => {
      objectUnderTest.serverless.providers.aws.request.mockReturnValue(Promise.resolve({
        Stacks: [{
          Outputs: [{
            OutputKey: 'some-key-1',
            OutputValue: 'some-value-1',
          }, {
            OutputKey: 'AwsDocApiId',
            OutputValue: 'testRestApiId',
          }, {
            OutputKey: 'some-key-2',
            OutputValue: 'some-value-2',
          }]
        }]
      }));

      return objectUnderTest._getRestApiId('testStackName').then((restApiId) => {
        expect(restApiId).toBe('testRestApiId');
        expect(objectUnderTest.serverless.providers.aws.request).toHaveBeenCalledWith(
          'CloudFormation',
          'describeStacks',
          expect.objectContaining({StackName: 'testStackName'}), 'testStage', 'testRegion'
        );
      });
    });
  });
});
