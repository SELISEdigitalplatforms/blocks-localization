using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Eurolm.DomainService.Shared
{
    public class ApiResponse
    {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
        public List<FluentValidation.Results.ValidationFailure>? ValidationErrors { get; set; }

        // Optional constructor for successful response
        public ApiResponse()
        {
            Success = true;
            ErrorMessage = null;
            ValidationErrors = null;
        }

        // Optional constructor for error response
        public ApiResponse(string errorMessage, List<FluentValidation.Results.ValidationFailure> validationErrors = null)
        {
            Success = false;
            ErrorMessage = errorMessage;
            ValidationErrors = validationErrors;
        }
    }
}
