UPDATE `funnels`
SET `deploymentStatus` = 'ready'
WHERE `status` = 'ready'
  AND (`deploymentStatus` IS NULL OR `deploymentStatus` = 'draft');

UPDATE `funnels`
SET `deploymentStatus` = 'deployed'
WHERE `status` = 'live';
