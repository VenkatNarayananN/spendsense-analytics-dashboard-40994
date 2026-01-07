class HealthService {
  /**
   * PUBLIC_INTERFACE
   * Returns a small, stable health payload for public probes.
   *
   * NOTE: Keep this payload minimal and non-sensitive since it is publicly accessible.
   *
   * @returns {{ ok: boolean, service: string }}
   */
  getStatus() {
    return {
      ok: true,
      service: 'backend',
    };
  }
}

module.exports = new HealthService();
