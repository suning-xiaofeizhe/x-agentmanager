-- xnpp_logs
-- template: `process-${YYYY-MM-DD}`
DROP TABLE IF EXISTS `process`;
CREATE TABLE `process`(
  `id` INT UNSIGNED AUTO_INCREMENT,
  `app_id` INT NOT NULL,
  `agent_id` VARCHAR(50) NOT NULL,
  `pid` INT NOT NULL,
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- cpu
  `cpu_now` FLOAT(5,2),
  `cpu_15` FLOAT(5,2),
  `cpu_30` FLOAT(5,2),
  `cpu_60` FLOAT(5,2),

  -- memory
  -- overview
  `rss` BIGINT,
  `heap_used` INT UNSIGNED,
  `heap_available` INT UNSIGNED,
  `heap_total` INT UNSIGNED,
  `heap_limit` INT UNSIGNED,
  `heap_executeable` INT UNSIGNED,
  `total_physical_size` INT UNSIGNED,
  `malloced_memory` INT UNSIGNED,
  `amount_of_external_allocated_memory` INT UNSIGNED,
  -- new space size
  `new_space_size` INT UNSIGNED,
  `new_space_used` INT UNSIGNED,
  `new_space_available` INT UNSIGNED,
  `new_space_committed` INT UNSIGNED,
  -- old space size
  `old_space_size` INT UNSIGNED,
  `old_space_used` INT UNSIGNED,
  `old_space_available` INT UNSIGNED,
  `old_space_committed` INT UNSIGNED,
  -- code space size
  `code_space_size` INT UNSIGNED,
  `code_space_used` INT UNSIGNED,
  `code_space_available` INT UNSIGNED,
  `code_space_committed` INT UNSIGNED,
  -- map space size
  `map_space_size` INT UNSIGNED,
  `map_space_used` INT UNSIGNED,
  `map_space_available` INT UNSIGNED,
  `map_space_committed` INT UNSIGNED,
  -- large object space size
  `lo_space_size` INT UNSIGNED,
  `lo_space_used` INT UNSIGNED,
  `lo_space_available` INT UNSIGNED,
  `lo_space_committed` INT UNSIGNED,

  -- uv handles
  `active_handles` INT,
  `file_handles_active` INT,
  `file_handles_inactive` INT,
  `tcp_handles_active` INT,
  `tcp_handles_inactive` INT,
  `udp_handles_active` INT,
  `udp_handles_inactive` INT,
  `timer_handles_active` INT,
  `timer_handles_inactive` INT,

  -- gc statistics
  `uptime` INT UNSIGNED,
  `gc_time_during_last_min` INT UNSIGNED,
  `total` INT UNSIGNED,
  `scavange_duration` INT UNSIGNED,
  `marksweep_duration`  INT UNSIGNED,
  `scavange_duration_total` INT UNSIGNED,
  `marksweep_duration_total` INT UNSIGNED,

  -- http
  `http_response_code_map` VARCHAR(1024) DEFAULT '',
  `live_http_request` INT UNSIGNED DEFAULT 0,
  `http_response_close` INT UNSIGNED DEFAULT 0,
  `http_response_sent` INT UNSIGNED DEFAULT 0,
  `http_request_timeout` INT UNSIGNED DEFAULT 0,
  `http_patch_timeout` INT UNSIGNED DEFAULT 0,
  `http_rt` DOUBLE DEFAULT 0,

  `gm_modified` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `gm_create` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`app_id`, `agent_id`, `pid`)
)ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `alarm`;
CREATE TABLE `alarm`(
  `id` INT UNSIGNED AUTO_INCREMENT,
  `strategy_id` INT UNSIGNED NOT NULL,
  `agent_id` VARCHAR(50) NOT NULL,
  `message` VARCHAR(200) NOT NULL,
  `pid` INT DEFAULT NULL,
  `gm_modified` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `gm_create` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`strategy_id`)
)ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `global_alarm`;
CREATE TABLE `global_alarm`(
  `id` INT UNSIGNED AUTO_INCREMENT,
  `strategy_id` INT UNSIGNED NOT NULL,
  `agent_id` VARCHAR(50) NOT NULL,
  `message` VARCHAR(200) NOT NULL,
  `pid` INT DEFAULT NULL,
  `gm_modified` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `gm_create` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`strategy_id`)
)ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `osinfo`;
CREATE TABLE `osinfo`(
  `id` INT UNSIGNED AUTO_INCREMENT,
  `app_id` INT NOT NULL,
  `agent_id` VARCHAR(50) NOT NULL,
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- cpu
  `used_cpu` DOUBLE,
  `cpu_count` INT UNSIGNED,
  `uptime` INT UNSIGNED,

  -- mem
  `totalmem` BIGINT UNSIGNED,
  `freemem` BIGINT UNSIGNED,

  -- load
  `load1` DOUBLE,
  `load5` DOUBLE,
  `load15` DOUBLE,

  -- disks
  `disks` VARCHAR(250),

  -- node count
  `node_count` INT UNSIGNED,

  -- http
  `http_response_code_map` VARCHAR(1024) DEFAULT '',
  `live_http_request` INT UNSIGNED DEFAULT 0,
  `http_response_close` INT UNSIGNED DEFAULT 0,
  `http_response_sent` INT UNSIGNED DEFAULT 0,
  `http_request_timeout` INT UNSIGNED DEFAULT 0,
  `http_patch_timeout` INT UNSIGNED DEFAULT 0,
  `http_rt` DOUBLE DEFAULT 0,

  `gm_modified` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `gm_create` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`app_id`, `agent_id`)
)ENGINE=InnoDB DEFAULT CHARSET=utf8;
