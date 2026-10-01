<?php

namespace frieren\modules\demo;

class ModuleLinuxHelper
{
    public static function getUbusSystemInfo()
    {
        $stats = \frieren\modules\dashboard\ModuleLinuxHelper::getUbusSystemInfo();
        if ($stats === false) {
            return false;
        }

        $meminfo = self::readMemInfo();
        $uptime = @file_get_contents('/proc/uptime');
        $load = @file_get_contents('/proc/loadavg');
        if ($meminfo === [] || $uptime === false || $load === false) {
            return false;
        }

        $uptimeSeconds = (int) floor((float) strtok(trim($uptime), ' '));
        $loadParts = preg_split('/\s+/', trim($load));
        $cores = $stats['cpu_cores'];

        return [
            'total_cores' => $cores,
            'load' => min(round(((float) ($loadParts[0] ?? 0) / max(1, $cores)) * 100, 1), 100),
            'swap_used' => ($meminfo['SwapTotal'] ?? 0) - ($meminfo['SwapFree'] ?? 0),
            'swap_total' => $meminfo['SwapTotal'] ?? 0,
            'memory_used' => ($meminfo['MemTotal'] ?? 0) - ($meminfo['MemAvailable'] ?? ($meminfo['MemFree'] ?? 0)),
            'memory_total' => $meminfo['MemTotal'] ?? 0,
            'uptime' => \frieren\modules\dashboard\ModuleLinuxHelper::secondsToUptime($uptimeSeconds),
            'localtime' => date('Y-m-d H:i:s'),
        ];
    }

    public static function secondsToUptime($seconds)
    {
        return \frieren\modules\dashboard\ModuleLinuxHelper::secondsToUptime($seconds);
    }

    private static function readMemInfo()
    {
        $lines = @file('/proc/meminfo');
        if ($lines === false) {
            return [];
        }

        $values = [];
        foreach ($lines as $line) {
            if (preg_match('/^([A-Za-z_]+):\s+(\d+)/', $line, $matches)) {
                $values[$matches[1]] = (int) $matches[2];
            }
        }

        return $values;
    }
}