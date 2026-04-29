import Generator from '@resultcrafter/nuxtus-generator'

export default async (_event) => {
  if (process.env.NODE_ENV !== 'production') {
    const nuxtus = new Generator()
    await nuxtus.createTypes()
    return {
      api: 'ok'
    }
  }
}
