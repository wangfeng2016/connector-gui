import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
  Autocomplete,
  Chip,
  Alert,
  Divider,
  Paper,
} from '@mui/material';
import { type SelectChangeEvent } from '@mui/material/Select';
import { mockResources } from '../../../contexts/ResourceContext';

// 策略类型定义
type PolicyType = 'restrict_consumer' | 'restrict_connector' | 'time_limit' | 'usage_count';

// 数据集接口
interface Dataset {
  id: number;
  name: string;
  description: string;
  uuid: string;
}

// 策略配置接口
interface PolicyConfig {
  type: PolicyType;
  consumers?: string[];
  connectors?: string[];
  startTime?: string;
  endTime?: string;
  maxUsageCount?: number;
}

// 模拟消费者数据
const mockConsumers = [
  { id: 'consumer-001', name: '数据消费者A', organization: '公司A' },
  { id: 'consumer-002', name: '数据消费者B', organization: '公司B' },
  { id: 'consumer-003', name: '数据消费者C', organization: '公司C' },
  { id: 'consumer-004', name: '数据消费者D', organization: '公司D' },
];

// 模拟连接器数据
const mockConnectors = [
  { id: 'connector-001', name: '连接器Alpha', endpoint: 'https://connector-a.example.com' },
  { id: 'connector-002', name: '连接器Beta', endpoint: 'https://connector-b.example.com' },
  { id: 'connector-003', name: '连接器Gamma', endpoint: 'https://connector-c.example.com' },
  { id: 'connector-004', name: '连接器Delta', endpoint: 'https://connector-d.example.com' },
];

// 策略类型选项
const policyTypeOptions = [
  { value: 'restrict_consumer', label: '指定消费者' },
  { value: 'restrict_connector', label: '指定连接器' },
  { value: 'time_limit', label: '限定使用时间' },
  { value: 'usage_count', label: '限定使用次数' },
];

// 生成UUID的辅助函数
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 转换资源数据为数据集格式
const convertToDatasets = (): Dataset[] => {
  return mockResources.map(resource => ({
    id: resource.id,
    name: resource.name,
    description: resource.description,
    uuid: generateUUID(),
  }));
};

// 生成IDS策略规范
const generateIDSPolicy = (dataset: Dataset, config: PolicyConfig): string => {
  const basePolicy = {
    "@context": {
      "ids": "https://w3id.org/idsa/core/",
      "idsc": "https://w3id.org/idsa/code/"
    },
    "@type": "ids:ContractAgreement",
    "@id": `https://w3id.org/idsa/autogen/contract/${dataset.uuid}`,
    "profile": "http://example.com/ids-profile",
    "ids:provider": "http://example.com/party/data-provider",
    "ids:consumer": "http://example.com/party/data-consumer",
    "ids:permission": [{
      "ids:target": {
        "@id": `http://example.com/ids/target/${dataset.uuid}`
      },
      "ids:action": [{
        "@id": "idsc:USE"
      }]
    }]
  };

  // 根据策略类型添加约束
  const permission = basePolicy["ids:permission"][0] as any;
  
  switch (config.type) {
    case 'restrict_consumer':
      if (config.consumers && config.consumers.length > 0) {
        basePolicy["ids:consumer"] = config.consumers[0];
      }
      break;
    case 'restrict_connector':
      if (config.connectors && config.connectors.length > 0) {
        permission["ids:constraint"] = [{
          "@type": "ids:Constraint",
          "ids:leftOperand": { "@id": "idsc:CONNECTOR" },
          "ids:operator": { "@id": "idsc:EQUALS" },
          "ids:rightOperand": [{
            "@value": config.connectors[0],
            "@type": "xsd:string"
          }]
        }];
      }
      break;
    case 'time_limit':
      if (config.startTime && config.endTime) {
        permission["ids:constraint"] = [{
          "@type": "ids:Constraint",
          "ids:leftOperand": { "@id": "idsc:POLICY_EVALUATION_TIME" },
          "ids:operator": { "@id": "idsc:AFTER" },
          "ids:rightOperand": [{
            "@value": config.startTime,
            "@type": "xsd:dateTimeStamp"
          }]
        }, {
          "@type": "ids:Constraint",
          "ids:leftOperand": { "@id": "idsc:POLICY_EVALUATION_TIME" },
          "ids:operator": { "@id": "idsc:BEFORE" },
          "ids:rightOperand": [{
            "@value": config.endTime,
            "@type": "xsd:dateTimeStamp"
          }]
        }];
      }
      break;
    case 'usage_count':
      if (config.maxUsageCount) {
        permission["ids:constraint"] = [{
          "@type": "ids:Constraint",
          "ids:leftOperand": { "@id": "idsc:COUNT" },
          "ids:operator": { "@id": "idsc:LTEQ" },
          "ids:rightOperand": [{
            "@value": config.maxUsageCount.toString(),
            "@type": "xsd:double"
          }]
        }];
      }
      break;
  }

  return JSON.stringify(basePolicy, null, 2);
};

// 生成ODRL策略规范
const generateODRLPolicy = (dataset: Dataset, config: PolicyConfig): string => {
  const basePolicy = {
    "@context": [
      "http://www.w3.org/ns/odrl.jsonld",
      {
        "dc": "http://purl.org/dc/terms/",
        "ids": "https://w3id.org/idsa/core/",
        "idsc": "https://w3id.org/idsa/code/"
      }
    ],
    "@type": "Agreement",
    "uid": `http://example.com/policy/${dataset.uuid}`,
    "profile": "http://www.w3.org/ns/odrl/2/core",
    "dc:creator": "Data Provider",
    "dc:description": `Policy for dataset: ${dataset.name}`,
    "dc:issued": new Date().toISOString(),
    "permission": [{
      "target": `http://example.com/ids/data/${dataset.uuid}`,
      "assigner": "http://example.com/ids/party/data-provider",
      "assignee": "http://example.com/ids/party/data-consumer",
      "action": "use"
    }]
  };

  const permission = basePolicy.permission[0] as any;

  switch (config.type) {
    case 'restrict_consumer':
      if (config.consumers && config.consumers.length > 0) {
        permission.assignee = config.consumers[0];
      }
      break;
    case 'restrict_connector':
      if (config.connectors && config.connectors.length > 0) {
        permission.constraint = [{
          "leftOperand": "connector",
          "operator": "eq",
          "rightOperand": config.connectors[0]
        }];
      }
      break;
    case 'time_limit':
      if (config.startTime && config.endTime) {
        permission.constraint = [{
          "leftOperand": "dateTime",
          "operator": "gteq",
          "rightOperand": { "@value": config.startTime, "@type": "xsd:dateTime" }
        }, {
          "leftOperand": "dateTime",
          "operator": "lteq",
          "rightOperand": { "@value": config.endTime, "@type": "xsd:dateTime" }
        }];
      }
      break;
    case 'usage_count':
      if (config.maxUsageCount) {
        permission.constraint = [{
          "leftOperand": "count",
          "operator": "lteq",
          "rightOperand": config.maxUsageCount
        }];
      }
      break;
  }

  return JSON.stringify(basePolicy, null, 2);
};

const DatasetPolicyEdit: React.FC = () => {
  const [datasets] = useState<Dataset[]>(convertToDatasets());
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [policyType, setPolicyType] = useState<PolicyType>('restrict_consumer');
  const [policyConfig, setPolicyConfig] = useState<PolicyConfig>({
    type: 'restrict_consumer',
    consumers: [],
    connectors: [],
    startTime: '',
    endTime: '',
    maxUsageCount: 1,
  });
  const [idsPolicy, setIdsPolicy] = useState<string>('');
  const [odrlPolicy, setOdrlPolicy] = useState<string>('');

  // 当数据集或策略配置改变时，更新策略规范
  useEffect(() => {
    if (selectedDataset) {
      const ids = generateIDSPolicy(selectedDataset, policyConfig);
      const odrl = generateODRLPolicy(selectedDataset, policyConfig);
      setIdsPolicy(ids);
      setOdrlPolicy(odrl);
    }
  }, [selectedDataset, policyConfig]);

  // 处理策略类型变化
  const handlePolicyTypeChange = (event: SelectChangeEvent) => {
    const newType = event.target.value as PolicyType;
    setPolicyType(newType);
    setPolicyConfig({
      ...policyConfig,
      type: newType,
    });
  };

  // 处理消费者选择变化
  const handleConsumersChange = (_event: any, newValue: string[]) => {
    setPolicyConfig({
      ...policyConfig,
      consumers: newValue,
    });
  };

  // 处理连接器选择变化
  const handleConnectorsChange = (_event: any, newValue: string[]) => {
    setPolicyConfig({
      ...policyConfig,
      connectors: newValue,
    });
  };

  // 处理时间变化
  const handleTimeChange = (field: 'startTime' | 'endTime') => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPolicyConfig({
      ...policyConfig,
      [field]: event.target.value,
    });
  };

  // 处理使用次数变化
  const handleUsageCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value) || 1;
    setPolicyConfig({
      ...policyConfig,
      maxUsageCount: value,
    });
  };

  // 保存策略
  const handleSavePolicy = () => {
    if (!selectedDataset) {
      alert('请先选择数据集');
      return;
    }
    
    // 这里可以添加保存策略的逻辑
    console.log('保存策略:', {
      dataset: selectedDataset,
      config: policyConfig,
      idsPolicy,
      odrlPolicy,
    });
    
    alert('策略保存成功！');
  };

  // 渲染策略配置选项
  const renderPolicyOptions = () => {
    switch (policyType) {
      case 'restrict_consumer':
        return (
          <Autocomplete
            multiple
            options={mockConsumers.map(c => c.id)}
            getOptionLabel={(option) => {
              const consumer = mockConsumers.find(c => c.id === option);
              return consumer ? `${consumer.name} (${consumer.organization})` : option;
            }}
            value={policyConfig.consumers || []}
            onChange={handleConsumersChange}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const consumer = mockConsumers.find(c => c.id === option);
                return (
                  <Chip
                    variant="outlined"
                    label={consumer ? consumer.name : option}
                    {...getTagProps({ index })}
                    key={option}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="选择允许的消费者"
                placeholder="请选择消费者"
                helperText="可以选择多个消费者"
              />
            )}
          />
        );
      
      case 'restrict_connector':
        return (
          <Autocomplete
            multiple
            options={mockConnectors.map(c => c.id)}
            getOptionLabel={(option) => {
              const connector = mockConnectors.find(c => c.id === option);
              return connector ? `${connector.name} (${connector.endpoint})` : option;
            }}
            value={policyConfig.connectors || []}
            onChange={handleConnectorsChange}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const connector = mockConnectors.find(c => c.id === option);
                return (
                  <Chip
                    variant="outlined"
                    label={connector ? connector.name : option}
                    {...getTagProps({ index })}
                    key={option}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="选择允许的连接器"
                placeholder="请选择连接器"
                helperText="可以选择多个连接器"
              />
            )}
          />
        );
      
      case 'time_limit':
        return (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <TextField
              fullWidth
              label="开始时间"
              type="datetime-local"
              value={policyConfig.startTime}
              onChange={handleTimeChange('startTime')}
              InputLabelProps={{
                shrink: true,
              }}
              helperText="数据使用的开始时间"
            />
            <TextField
              fullWidth
              label="结束时间"
              type="datetime-local"
              value={policyConfig.endTime}
              onChange={handleTimeChange('endTime')}
              InputLabelProps={{
                shrink: true,
              }}
              helperText="数据使用的结束时间"
            />
          </Box>
        );
      
      case 'usage_count':
        return (
          <TextField
            fullWidth
            label="最大使用次数"
            type="number"
            value={policyConfig.maxUsageCount}
            onChange={handleUsageCountChange}
            inputProps={{ min: 1 }}
            helperText="数据可以被使用的最大次数"
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        数据集策略管理
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        为数据集定义使用策略，控制数据的访问和使用权限。
      </Typography>

      <Stack spacing={3}>
        {/* 数据集选择区域 */}
        <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              选择数据集
            </Typography>
            
            <Autocomplete
              options={datasets}
              getOptionLabel={(option) => `${option.name} (${option.description})`}
              value={selectedDataset}
              onChange={(_event, newValue) => setSelectedDataset(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="选择要配置策略的数据集"
                  placeholder="请选择数据集"
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      UUID: {option.uuid}
                    </Typography>
                  </Box>
                </Box>
              )}
            />
            
            {selectedDataset && (
              <Alert severity="info" sx={{ mt: 2, borderRadius: 1 }}>
                已选择数据集：<strong>{selectedDataset.name}</strong>
                <br />
                UUID: {selectedDataset.uuid}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 策略配置区域 */}
        {selectedDataset && (
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                策略配置
              </Typography>
              
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <Box sx={{ flex: { xs: 1, md: 0.5 } }}>
                    <FormControl fullWidth>
                      <InputLabel>策略类型</InputLabel>
                      <Select
                        value={policyType}
                        label="策略类型"
                        onChange={handlePolicyTypeChange}
                      >
                        {policyTypeOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Box>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
                    策略参数配置
                  </Typography>
                  {renderPolicyOptions()}
                </Box>
              </Stack>
              
              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={handleSavePolicy}
                  size="large"
                  sx={{ borderRadius: 2, px: 4 }}
                >
                  保存策略
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* 策略规范显示区域 */}
        {selectedDataset && idsPolicy && (
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                策略规范
              </Typography>
              
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', lg: 'row' }, 
                gap: 2,
                mt: 2
              }}>
                <Box sx={{ flex: 1 }}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, height: 'fit-content' }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
                      IDS 策略规范
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={20}
                      value={idsPolicy}
                      variant="outlined"
                      InputProps={{
                        readOnly: true,
                        sx: { 
                          fontFamily: 'monospace', 
                          fontSize: '0.875rem',
                          borderRadius: 1
                        }
                      }}
                    />
                  </Paper>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, height: 'fit-content' }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
                      ODRL 策略规范
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={20}
                      value={odrlPolicy}
                      variant="outlined"
                      InputProps={{
                        readOnly: true,
                        sx: { 
                          fontFamily: 'monospace', 
                          fontSize: '0.875rem',
                          borderRadius: 1
                        }
                      }}
                    />
                  </Paper>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
};

export default DatasetPolicyEdit;