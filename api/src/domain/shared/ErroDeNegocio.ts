export class ErroDeNegocio extends Error {
  constructor(
    message: string,
    readonly status: number = 422,
    readonly contexto?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ErroDeNegocio";
  }
}

export class NaoEncontrado extends ErroDeNegocio {
  constructor(message: string) {
    super(message, 404);
    this.name = "NaoEncontrado";
  }
}

export class Conflito extends ErroDeNegocio {
  constructor(message: string, contexto?: Record<string, unknown>) {
    super(message, 409, contexto);
    this.name = "Conflito";
  }
}
