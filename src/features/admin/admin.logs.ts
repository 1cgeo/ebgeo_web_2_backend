import { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { ApiError } from '../../common/errors/apiError.js';
import { LogCategory } from '../../common/config/logger.js';
import readline from 'readline';
import { createReadStream } from 'fs';
import { sendJsonResponse } from '../../common/helpers/response.js';

const MAX_LOGS = 1000; // Limite máximo de logs retornados
const DEFAULT_LIMIT = 100; // Limite padrão

interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  category: LogCategory;
  message: string;
  details?: Record<string, unknown>;
}

// Função para ler as últimas N linhas de um arquivo
async function readLastLines(
  filePath: string,
  maxLines: number,
): Promise<string[]> {
  const chunks: string[] = [];
  const fileStream = createReadStream(filePath, { encoding: 'utf8' });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    chunks.push(line);
    if (chunks.length > maxLines) {
      chunks.shift(); // Remove a linha mais antiga se exceder o limite
    }
  }

  return chunks;
}

// Função para verificar se um log atende aos critérios de filtragem
function matchesFilters(log: LogEntry, level?: string): boolean {
  if (level && log.level !== level) {
    return false;
  }
  return true;
}

// Função principal de consulta de logs
export async function queryLogs(req: Request, res: Response) {
  try {
    const { category, level, limit = DEFAULT_LIMIT } = req.query;

    // Validar parâmetros
    const validatedLimit = Math.min(Number(limit), MAX_LOGS);
    if (isNaN(validatedLimit) || validatedLimit < 1) {
      throw ApiError.badRequest('Limite inválido');
    }

    const logDir = process.env.LOG_DIR || 'logs';

    // Determinar quais arquivos de log processar
    let logFiles: string[];
    if (
      category &&
      typeof category === 'string' &&
      Object.values(LogCategory).includes(category as LogCategory)
    ) {
      // Se categoria específica solicitada
      const categoryFile = path.join(logDir, `${category.toLowerCase()}.log`);
      logFiles = [categoryFile];
    } else {
      // Caso contrário, pegar todos os arquivos de categoria
      const categories = Object.values(LogCategory);
      logFiles = categories.map(cat =>
        path.join(logDir, `${cat.toLowerCase()}.log`),
      );
    }

    // Filtrar apenas arquivos que existem
    const existingFiles = await Promise.all(
      logFiles.map(async file => {
        try {
          await fs.access(file);
          return file;
        } catch {
          return null;
        }
      }),
    );
    logFiles = existingFiles.filter((file): file is string => file !== null);

    if (logFiles.length === 0) {
      return sendJsonResponse(res, {
        logs: [],
        total: 0,
        limit: validatedLimit,
      });
    }

    // Ler e processar logs de cada arquivo
    const logsPromises = logFiles.map(async file => {
      try {
        // Ler últimas N linhas do arquivo
        const lines = await readLastLines(file, validatedLimit);

        // Processar e filtrar logs
        return lines
          .map(line => {
            try {
              const log = JSON.parse(line) as LogEntry;
              return matchesFilters(log, level as string | undefined)
                ? log
                : null;
            } catch {
              return null;
            }
          })
          .filter((log): log is LogEntry => log !== null);
      } catch (error) {
        console.error(`Erro ao processar arquivo ${file}:`, error);
        return [];
      }
    });

    // Aguardar processamento de todos os arquivos
    const logsArrays = await Promise.all(logsPromises);

    // Mesclar, ordenar e limitar logs
    const allLogs = logsArrays
      .flat()
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, validatedLimit);

    // Formatar resposta
    const response = {
      logs: allLogs,
      total: allLogs.length,
      limit: validatedLimit,
      categories: logFiles.map(file =>
        path.basename(file, '.log').toUpperCase(),
      ),
    };

    return sendJsonResponse(res, response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.internal('Erro ao consultar logs');
  }
}

// Função para analisar logs recentes
export async function analyzeRecentLogs(): Promise<{
  errors24h: number;
  warnings24h: number;
  totalRequests24h: number;
}> {
  const logDir = process.env.LOG_DIR || 'logs';
  const hoursToAnalyze = 24;
  let errors = 0;
  let warnings = 0;
  let totalRequests = 0;

  try {
    // Ler apenas os arquivos relevantes para as métricas que precisamos
    const filesToAnalyze = [
      path.join(logDir, 'error.log'), // Para erros
      path.join(logDir, 'system.log'), // Para erros e warnings
      path.join(logDir, 'api.log'), // Para total de requests
    ];

    const existingFiles = await Promise.all(
      filesToAnalyze.map(async file => {
        try {
          await fs.access(file);
          return file;
        } catch {
          return null;
        }
      }),
    );

    const validFiles = existingFiles.filter(
      (file): file is string => file !== null,
    );

    // Processar cada arquivo
    const processFiles = validFiles.map(async file => {
      try {
        const lines = await readLastLines(file, 10000); // Número maior para garantir cobertura de 24h

        lines.forEach(line => {
          try {
            const log = JSON.parse(line) as LogEntry;
            const logTime = new Date(log.timestamp);
            const cutoffTime = new Date(
              Date.now() - hoursToAnalyze * 60 * 60 * 1000,
            );

            if (logTime >= cutoffTime) {
              if (log.level === 'ERROR') errors++;
              if (log.level === 'WARN') warnings++;
              if (log.category === LogCategory.API) totalRequests++;
            }
          } catch {
            // Ignora linhas com JSON inválido
          }
        });
      } catch (error) {
        // Log error but continue processing other files
        console.error(`Error processing file ${file}:`, error);
      }
    });

    await Promise.all(processFiles);
  } catch (error) {
    console.error('Error analyzing logs:', error);
    // Return zeros instead of throwing to maintain metrics stability
    return {
      errors24h: 0,
      warnings24h: 0,
      totalRequests24h: 0,
    };
  }

  return {
    errors24h: errors,
    warnings24h: warnings,
    totalRequests24h: totalRequests,
  };
}
