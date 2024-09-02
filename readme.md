# Transaction Engine

Transaction Engine is a service designed to handle and process transactions. It interacts with various APIs and databases to fetch token prices, calculate transaction details, and store transaction information.


## Prerequisites

- Node.js (version 20 or later)
- pnpm (version 7 or later)
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/Bulk-trade/transaction-engine
    cd transaction-engine
    ```

2. Install dependencies:
    ```sh
    pnpm install
    ```

3. Set up environment variables:
    - Create a [`.env`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FUsers%2Fmac%2FDesktop%2FBULK%2Ftransaction-engine%2F.env%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "/Users/mac/Desktop/BULK/transaction-engine/.env") file in the root directory and add the necessary environment variables. Refer to `.env.example` for the required variables.

## Running the Application

### Using Node.js

1. Build the TypeScript code:
    ```sh
    pnpm run build
    ```

2. Start the application:
    ```sh
    pnpm start
    ```

### Using Docker

1. Build the Docker image:
    ```sh
    docker build -t transaction-engine .
    ```

2. Run the Docker container:
    ```sh
    docker run -d -p 3000:3000 --env-file .env transaction-engine
    ```

### Using Docker Compose

1. Start the services:
    ```sh
    docker-compose up --build --scale app=5 -d
    ```

## Development

1. Start the application in development mode:
    ```sh
    pnpm run dev
    ```

## Logging

Logs are stored in the [`logs`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FUsers%2Fmac%2FDesktop%2FBULK%2Ftransaction-engine%2Flogs%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "/Users/mac/Desktop/BULK/transaction-engine/logs") directory. You can view the logs by opening the [`logs/bulk.log`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FUsers%2Fmac%2FDesktop%2FBULK%2Ftransaction-engine%2Flogs%2Fbulk.log%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "/Users/mac/Desktop/BULK/transaction-engine/logs/bulk.log") file.

## License

This project is licensed under the ISC License.